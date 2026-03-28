import os
import json
import requests
from dotenv import load_dotenv
from flask import Flask, request
from scalekit.client import ScalekitClient

load_dotenv()

IDENTIFIER          = os.getenv("IDENTIFIER", "user-001")
JIRA_CONNECTION     = os.getenv("JIRA_CONNECTION_NAME", "jira")
GMAIL_CONNECTION    = os.getenv("GMAIL_CONNECTION_NAME", "gmail")
MEETSTREAM_API_KEY  = os.getenv("MEET_STREAM_API_KEY")
MEETSTREAM_BASE_URL = "https://api.meetstream.ai/api/v1"
ESCALATION_EMAIL    = os.getenv("ESCALATION_EMAIL", "manager@yourcompany.com")

scalekit = ScalekitClient(
    env_url=os.getenv("SCALEKIT_ENV_URL"),
    client_id=os.getenv("SCALEKIT_CLIENT_ID"),
    client_secret=os.getenv("SCALEKIT_CLIENT_SECRET"),
)


def ensure_connection(connection_name: str, label: str):
    try:
        resp = scalekit.actions.get_or_create_connected_account(
            connection_name=connection_name,
            identifier=IDENTIFIER,
        )
    except Exception as e:
        raise RuntimeError(
            f"\n{'━'*52}\n"
            f"  {label} connection error: {e}\n\n"
            f"  Create it: app.scalekit.com → Agent Auth → Connections\n"
            f"{'━'*52}\n"
        ) from e

    account = resp.connected_account
    if account.status != "ACTIVE":
        link = scalekit.actions.get_authorization_link(
            connection_name=connection_name,
            identifier=IDENTIFIER,
        ).link
        print(f"\n{label} not connected. Authorize here:\n\n    {link}\n")
        input(f"⎆ Press Enter after authorizing {label}...")
        recheck = scalekit.actions.get_or_create_connected_account(
            connection_name=connection_name,
            identifier=IDENTIFIER,
        ).connected_account
        if recheck.status != "ACTIVE":
            raise RuntimeError(f"{label} authorization incomplete.")
        print(f"✓ {label} connected: {recheck.id}")
    else:
        print(f"✓ {label} connected: {account.id}")


def ensure_all_authenticated():
    ensure_connection(JIRA_CONNECTION,  "Jira")
    ensure_connection(GMAIL_CONNECTION, "Gmail")


def get_bot_details(bot_id: str) -> dict:
    resp = requests.get(
        f"{MEETSTREAM_BASE_URL}/bots/{bot_id}/detail",
        headers={"Authorization": f"Token {MEETSTREAM_API_KEY}"},
    )
    resp.raise_for_status()
    return resp.json().get("bot_details", {})


def score_transcript(text: str) -> dict:
    t = text.lower()

    def score(keywords):
        hits = sum(1 for k in keywords if k in t)
        return "High" if hits >= 3 else "Medium" if hits >= 1 else "Low"

    return {
        "churn_risk":        score(["cancel", "cancelling", "leaving", "switching", "competitor", "disappointed"]),
        "refund_likelihood": score(["refund", "money back", "charge", "overcharged", "billed incorrectly"]),
        "escalation_need":   score(["manager", "supervisor", "unacceptable", "legal", "sue", "complaint"]),
        "summary":           text[:300] + "..." if len(text) > 300 else text,
    }


def create_jira_ticket(scores: dict, bot: dict, meeting_link: str) -> str:
    result = scalekit.actions.execute_tool(
        tool_name="jira_issue_create",
        identifier=IDENTIFIER,
        tool_input={
            "project_key": os.getenv("JIRA_PROJECT_KEY", "CG"),
            "summary": f"[{scores['escalation_need']} Escalation] Call — {bot.get('StartTime', 'N/A')}",
            "description": (
                f"Meeting: {meeting_link}\n"
                f"Platform: {bot.get('Platform', 'N/A')}\n"
                f"Duration: {bot.get('Duration', 'N/A')}s\n\n"
                f"Churn Risk: {scores['churn_risk']}\n"
                f"Refund Likelihood: {scores['refund_likelihood']}\n"
                f"Escalation Need: {scores['escalation_need']}\n\n"
                f"Summary: {scores['summary']}"
            ),
            "issue_type": "Task",
            "priority": "High",
        },
    )
    url = result.data.get("url", "N/A")
    print(f"  🎫 Jira ticket: {url}")
    return url


def send_gmail_alert(scores: dict, meeting_link: str, ticket_url: str = None):
    body = (
        f"CallGuard AI flagged a call that needs your attention.\n\n"
        f"Meeting: {meeting_link}\n"
        f"Churn Risk: {scores['churn_risk']}\n"
        f"Refund Likelihood: {scores['refund_likelihood']}\n"
        f"Escalation Need: {scores['escalation_need']}\n\n"
        f"Summary: {scores['summary']}\n"
    )
    if ticket_url:
        body += f"\nJira Ticket: {ticket_url}"

    scalekit.actions.execute_tool(
        tool_name="gmail_send_email",
        identifier=IDENTIFIER,
        tool_input={
            "to": ESCALATION_EMAIL,
            "subject": f"🚨 CallGuard Alert — {scores['escalation_need']} Escalation",
            "body": body,
        },
    )
    print(f"  📧 Gmail alert sent to {ESCALATION_EMAIL}")


ensure_all_authenticated()

app = Flask(__name__)


@app.route("/webhook", methods=["POST"])
def webhook():
    data = request.get_json(silent=True)
    print(f"\n[event] {data.get('event') if data else 'empty'}")

    if not data or not data.get("event", "").startswith("transcription."):
        return "", 200

    bot_id       = data.get("bot_id", "unknown")
    bot          = get_bot_details(bot_id)
    meeting_link = bot.get("MeetingLink", "N/A")

    transcript_text = data.get("data", {}).get("transcript", "") or json.dumps(data)
    scores = score_transcript(transcript_text)

    print(f"  churn:{scores['churn_risk']} | refund:{scores['refund_likelihood']} | escalation:{scores['escalation_need']}")

    ticket_url = None

    if scores["churn_risk"] == "High" or scores["escalation_need"] == "High":
        ticket_url = create_jira_ticket(scores, bot, meeting_link)

    if scores["escalation_need"] == "High":
        send_gmail_alert(scores, meeting_link, ticket_url)

    return "", 200


if __name__ == "__main__":
    app.run(port=8999, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
