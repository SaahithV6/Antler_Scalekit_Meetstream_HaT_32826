import os
from dotenv import load_dotenv
from fastmcp import FastMCP
from scalekit.client import ScalekitClient

load_dotenv(dotenv_path="../.env")

IDENTIFIER       = os.getenv("IDENTIFIER", "user-001")
JIRA_CONNECTION  = os.getenv("JIRA_CONNECTION_NAME", "jira")
GMAIL_CONNECTION = os.getenv("GMAIL_CONNECTION_NAME", "gmail")

scalekit = ScalekitClient(
    env_url=os.getenv("SCALEKIT_ENV_URL"),
    client_id=os.getenv("SCALEKIT_CLIENT_ID"),
    client_secret=os.getenv("SCALEKIT_CLIENT_SECRET"),
)

mcp = FastMCP("callguard-tools")


@mcp.tool()
def create_jira_ticket(summary: str, description: str, priority: str = "High") -> str:
    """
    Create a Jira ticket for a high-risk or escalation call.
    Use when churn risk is High or escalation need is High.
    Parameters:
    - summary: One-line title e.g. "[High Escalation] Customer threatening to cancel — 2026-03-28"
    - description: Full breakdown including churn risk, refund likelihood, escalation need, and a 2-3 sentence call summary
    - priority: "High", "Medium", or "Low" — match to the highest score across all three dimensions
    """
    result = scalekit.actions.execute_tool(
        tool_name="jira_issue_create",
        identifier=IDENTIFIER,
        tool_input={
            "project_key": os.getenv("JIRA_PROJECT_KEY", "CG"),
            "summary": summary,
            "description": description,
            "issue_type": "Task",
            "priority": priority,
        },
    )
    return f"Jira ticket created: {result.data.get('url', 'done')}"


@mcp.tool()
def send_gmail(to: str, subject: str, body: str) -> str:
    """
    Send a Gmail alert to a stakeholder about a critical call outcome.
    Use when escalation need is High. Include Jira ticket URL in body if one was created.
    Parameters:
    - to: The escalation email address
    - subject: e.g. "🚨 CallGuard Alert — High Escalation on call 2026-03-28"
    - body: Include churn risk, refund likelihood, escalation need, call summary, and Jira ticket URL
    """
    scalekit.actions.execute_tool(
        tool_name="gmail_send_email",
        identifier=IDENTIFIER,
        tool_input={"to": to, "subject": subject, "body": body},
    )
    return f"Email sent to {to}"


if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8000)
