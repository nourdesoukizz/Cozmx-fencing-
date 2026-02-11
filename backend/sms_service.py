from config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER


def send_sms(to: str, body: str) -> dict:
    """Send an SMS via Twilio. Falls back to console logging if not configured."""
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
        print(f"[SMS LOG] To: {to} | Body: {body}")
        return {"status": "logged", "to": to}

    try:
        from twilio.rest import Client
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            body=body,
            from_=TWILIO_PHONE_NUMBER,
            to=to,
        )
        return {"status": "sent", "sid": message.sid, "to": to}
    except Exception as exc:
        print(f"[SMS ERROR] To: {to} | Error: {exc}")
        return {"status": "failed", "error": str(exc), "to": to}
