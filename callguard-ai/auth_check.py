import os
from dotenv import load_dotenv
from scalekit.client import ScalekitClient

load_dotenv()

scalekit = ScalekitClient(
    env_url=os.getenv("SCALEKIT_ENV_URL"),
    client_id=os.getenv("SCALEKIT_CLIENT_ID"),
    client_secret=os.getenv("SCALEKIT_CLIENT_SECRET"),
)

for name, label in [("jira", "Jira"), ("gmail", "Gmail")]:
    resp = scalekit.actions.get_or_create_connected_account(
        connection_name=name,
        identifier=os.getenv("IDENTIFIER", "user-001"),
    )
    acct = resp.connected_account
    if acct.status != "ACTIVE":
        link = scalekit.actions.get_authorization_link(
            connection_name=name,
            identifier=os.getenv("IDENTIFIER", "user-001"),
        ).link
        print(f"\n{label} not authorized. Visit this link:\n\n    {link}\n")
        input(f"Press Enter after authorizing {label}...")
        recheck = scalekit.actions.get_or_create_connected_account(
            connection_name=name,
            identifier=os.getenv("IDENTIFIER", "user-001"),
        ).connected_account
        if recheck.status != "ACTIVE":
            raise RuntimeError(f"{label} authorization incomplete. Restart and try again.")
        print(f"✓ {label} active: {recheck.id}")
    else:
        print(f"✓ {label} active: {acct.id}")
