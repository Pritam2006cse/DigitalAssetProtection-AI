import smtplib
from email.mime.text import MIMEText

def send_email(to_email,subject,body):
    sender_email = "mygmailaddress@gmail.com"
    password = "my app password"
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