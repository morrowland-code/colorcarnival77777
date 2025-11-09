from flask import Flask, jsonify, request, send_from_directory, session
import json, os, io, base64, csv, random, secrets, sqlite3
from datetime import datetime
from PIL import Image
import colorsys
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS

app = Flask(__name__, static_folder="static")
# Default palette data file (used for initialization)
DATA_FILE = "data/palettes.json"
PREMIUM_FILE = "data/premium_codes.json"
os.makedirs("data", exist_ok=True)

# Each user gets their own saved palettes file
def get_user_data_file(user_email):
    safe_name = user_email.replace("@", "_at_").replace(".", "_dot_")
    return f"data/palettes_{safe_name}.json"
app.secret_key = "supersecretkey"  # change later
CORS(app, supports_credentials=True)

def get_user_data_file(user_email):
    safe_name = user_email.replace("@", "_at_").replace(".", "_dot_")
    return f"data/palettes_{safe_name}.json"
PREMIUM_FILE = "data/premium_codes.json"
USER_DB = "data/users.db"
os.makedirs("data", exist_ok=True)

# ===== Initialize user database =====
def init_user_db():
    conn = sqlite3.connect(USER_DB)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_user_db()

# ========== INITIAL DATA ==========
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w") as f:
        json.dump({"palettes": []}, f, indent=2)

if not os.path.exists(PREMIUM_FILE):
    with open(PREMIUM_FILE, "w") as f:
        json.dump({"codes": {}}, f, indent=2)

def load_data():
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

def load_premium():
    with open(PREMIUM_FILE, "r") as f:
        return json.load(f)

def save_premium(data):
    with open(PREMIUM_FILE, "w") as f:
        json.dump(data, f, indent=2)

# ========== USER AUTHENTICATION ==========
@app.route("/api/register", methods=["POST"])
def register_user():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")
    if not username or not password:
        return jsonify({"error": "Missing fields"}), 400

    conn = sqlite3.connect(USER_DB)
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (username, password) VALUES (?, ?)", 
                  (username, generate_password_hash(password)))
        conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already taken"}), 409
    finally:
        conn.close()
    return jsonify({"message": "User registered successfully"}), 201


@app.route("/api/login", methods=["POST"])
def login_user():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")
    conn = sqlite3.connect(USER_DB)
    c = conn.cursor()
    c.execute("SELECT id, password FROM users WHERE username=?", (username,))
    user = c.fetchone()
    conn.close()
    if user and check_password_hash(user[1], password):
        session["user_id"] = user[0]
        session["username"] = username
        return jsonify({"message": "Login successful", "username": username})
    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/api/logout", methods=["POST"])
def logout_user():
    session.clear()
    return jsonify({"message": "Logged out"})

@app.route("/api/session-status")
def session_status():
    user = session.get("username")
    if user:
        return jsonify({"logged_in": True, "username": user})
    else:
        return jsonify({"logged_in": False})

@app.route("/terms")
def terms_page():
    return send_from_directory(app.static_folder, "terms.html")

@app.route("/privacy")
def privacy_page():
    return send_from_directory(app.static_folder, "privacy.html")

# ========== SERVE FRONTEND ROUTES ==========
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/palette")
def palette_page():
    return send_from_directory(app.static_folder, "palette.html")

@app.route("/grid")
def grid_page():
    return send_from_directory(app.static_folder, "grid.html")

@app.route("/pressure")
def pressure_page():
    return send_from_directory(app.static_folder, "pressure.html")

@app.route("/tutorial")
def tutorial_page():
    return send_from_directory(app.static_folder, "tutorial.html")

@app.route("/premium")
def premium_page():
    return send_from_directory(app.static_folder, "premium.html")

# ========== PALETTE API (per-user if logged in, otherwise shared) ==========

def load_user_palettes():
    """
    If a user is logged in (session['username']), use their own palettes file.
    If not, fall back to the shared DATA_FILE so the app still works.
    Returns (data_dict, path)
    """
    username = session.get("username")
    if username:
        path = get_user_data_file(username)
    else:
        path = DATA_FILE

    if not os.path.exists(path):
        return {"palettes": []}, path

    with open(path, "r") as f:
        data = json.load(f)

    if "palettes" not in data:
        data["palettes"] = []

    return data, path


def save_user_palettes(data, path):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


# ========== PALETTE API (fully per-user) ==========

def load_user_palette_data():
    """Return (data_dict, file_path) based on current session username."""
    username = session.get("username")
    if username:
        path = get_user_data_file(username)
    else:
        # Guests get their own shared guest file
        path = DATA_FILE

    if not os.path.exists(path):
        data = {"palettes": []}
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        return data, path

    with open(path, "r") as f:
        data = json.load(f)
    if "palettes" not in data:
        data["palettes"] = []
    return data, path


def save_user_palette_data(data, path):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


@app.route("/api/palettes", methods=["GET"])
def get_palettes():
    data, _ = load_user_palette_data()
    return jsonify(data["palettes"])


@app.route("/api/palettes", methods=["POST"])
def create_palette():
    data, path = load_user_palette_data()
    body = request.get_json()
    name = body.get("name", "").strip()
    if not name:
        return jsonify({"error": "Palette name required"}), 400

    # Don’t duplicate existing palette names
    for p in data["palettes"]:
        if p["name"].lower() == name.lower():
            return jsonify(p), 200

    new_palette = {
        "id": len(data["palettes"]) + 1,
        "name": name,
        "colors": []
    }
    data["palettes"].append(new_palette)
    save_user_palette_data(data, path)
    return jsonify(new_palette), 201


@app.route("/api/palettes/<int:palette_id>/colors", methods=["POST"])
def add_color_to_palette(palette_id):
    data, path = load_user_palette_data()
    body = request.get_json()
    for p in data["palettes"]:
        if p["id"] == palette_id:
            color = {
                "id": len(p["colors"]) + 1,
                "name": body.get("name"),
                "hex": body.get("hex"),
                "rgb": body.get("rgb"),
            }
            p["colors"].append(color)
            save_user_palette_data(data, path)
            return jsonify(color), 201
    return jsonify({"error": "Palette not found"}), 404


@app.route("/api/palettes/<int:palette_id>/colors/<int:color_id>", methods=["DELETE"])
def delete_color(palette_id, color_id):
    data, path = load_user_palette_data()
    for p in data["palettes"]:
        if p["id"] == palette_id:
            p["colors"] = [c for c in p["colors"] if c["id"] != color_id]
            save_user_palette_data(data, path)
            return jsonify({"message": "Color deleted"}), 200
    return jsonify({"error": "Palette not found"}), 404


@app.route("/api/palettes/<int:palette_id>", methods=["DELETE"])
def delete_palette(palette_id):
    data, path = load_user_palette_data()
    data["palettes"] = [p for p in data["palettes"] if p["id"] != palette_id]
    save_user_palette_data(data, path)
    return jsonify({"message": "Palette deleted"}), 200
# ========== PRESSURE ANALYZER ==========
@app.route("/api/pressure", methods=["POST"])
def pressure_chart():
    data = request.get_json()
    target, actual = data.get("target"), data.get("actual")
    if not target or not actual:
        return jsonify({"error": "Missing color data"}), 400
    def rgb_to_hsl(c):
        r, g, b = [x / 255 for x in (c["r"], c["g"], c["b"])]
        h, l, s = colorsys.rgb_to_hls(r, g, b)
        return {"s": s}
    diff = abs(rgb_to_hsl(target)["s"] - rgb_to_hsl(actual)["s"]) * 100
    return jsonify({
        "saturation_difference": round(diff, 1),
        "pressure_value": round(100 - diff, 1)
    })

# ========== EXPORT TO CSV ==========
@app.route("/api/grid/export", methods=["POST"])
def export_grid_csv():
    data = request.get_json()
    matched = data.get("matched", [])
    os.makedirs("exports", exist_ok=True)
    filename = f"grid_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    path = os.path.join("exports", filename)
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Grid Cell Color", "Top Matches"])
        for row in matched:
            matches = ", ".join([f"{m['name']} ({m['hex']})" for m in row.get("matches", [])])
            writer.writerow([row["cell"], matches])
    return jsonify({"message": "Export successful!", "file": f"/{path}"})

# ======================================================
# 🧩 GRID EXTRACT + MATCH + MIX (with premium flag)
# ======================================================
@app.route("/api/grid/extract_match_mix", methods=["POST"])
def extract_match_mix():
    """
    Expects JSON: { "image": base64, "grid_size": 20, "palette": [...], "premium": bool }
    """
    body = request.get_json()
    img_b64 = body.get("image")
    grid_size = int(body.get("grid_size", 40))
    palette = body.get("palette", [])
    is_premium = True
    
    if not img_b64 or not palette:
        return jsonify({"error": "Missing image or palette"}), 400

    # Extract center pixel per grid square
    img_bytes = base64.b64decode(img_b64.split(",")[1])
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    w, h = img.size
    cell_w, cell_h = w // grid_size, h // grid_size

    def hex_to_rgb(hexcode):
        hexcode = hexcode.lstrip("#")
        return tuple(int(hexcode[i:i+2], 16) for i in (0, 2, 4))

    def color_dist(c1, c2):
        return sum((a-b)**2 for a,b in zip(c1,c2))**0.5

    results = []
    cell_w = grid_size
    cell_h = grid_size

    for y in range(0, h, cell_h):
        for x in range(0, w, cell_w):
            cx = min(x + cell_w // 2, w - 1)
            cy = min(y + cell_h // 2, h - 1)
            r, g, b = img.getpixel((cx, cy))
            cell_hex = f"#{r:02x}{g:02x}{b:02x}"

            ranked = sorted(
                palette, key=lambda p: color_dist((r, g, b), hex_to_rgb(p["hex"]))
            )[:5]

            cell_result = {
                "cell": cell_hex,
                "matches": [{"name": p["name"], "hex": p["hex"]} for p in ranked],
            }

            # Optional mix data
            mix_data = []
            for p in ranked[:5]:
                mix_data.append({
                    "mix_with": p["name"],
                    "ratio": round(random.uniform(10, 30), 1),
                    "hex": p["hex"]
                })
            cell_result["mix_colors"] = mix_data

            results.append(cell_result)
    return jsonify({"matched": results, "count": len(results)})

if __name__ == "__main__":
    app.run(debug=True, port=5000)