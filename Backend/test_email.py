import smtplib

email = "sarkarpuspita81@gmail.com"
password = "ccpphpsxdyxfbgep"

try:
    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(email, password)
    print("✅ LOGIN SUCCESS")
except Exception as e:
    print("❌ ERROR:", e)