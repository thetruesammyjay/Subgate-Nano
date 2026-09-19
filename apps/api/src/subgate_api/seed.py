"""Development data entrypoint.

Seed records will be added alongside the first SQLAlchemy stream models.
Keeping the command available now makes the migration workflow stable.
"""


def main() -> None:
    print("No seed data yet: add stream fixtures with the SQLAlchemy persistence slice.")


if __name__ == "__main__":
    main()
