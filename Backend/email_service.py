import smtplib
import os
from dotenv import load_dotenv
from email.mime.text import MIMEText

load_dotenv()
def send_email(to_email,subject,body):
    sender_email = os.getenv("SENDER_EMAIL")
    password = os.getenv("SENDER_PASSWORD")
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = sender_email
    msg["To"] = to_email

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com",465) as server:
            server.login(sender_email,password)
            server.sendmail(sender_email,to_email,msg.as_string())
        return True
    except Exception as e:
        print("Email Error: ",e)
        return False