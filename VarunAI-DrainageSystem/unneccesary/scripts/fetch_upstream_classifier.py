"""Fetch only the published classifier assets from the 12 GB source archive."""

from pathlib import Path

from remotezip import RemoteZip


ARCHIVE_URL = "https://researchdata.reading.ac.uk/498/2/blockagedetection_dataset.zip"
MEMBERS = ("classification_network.py", "crop_coordinates.txt", "weights/classifier.pth")


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    output = (root / "evaluation" / "upstream").resolve()
    if root not in output.parents:
        raise RuntimeError("Output escaped the workspace")
    output.mkdir(parents=True, exist_ok=True)
    with RemoteZip(ARCHIVE_URL) as archive:
        for member in MEMBERS:
            destination = output / Path(member).name
            destination.write_bytes(archive.read(member))
            print(f"fetched {member}: {destination.stat().st_size:,} bytes", flush=True)


if __name__ == "__main__":
    main()
