# DSC 209R Final Project: After the Peak

The uneven drop in U.S. overdose deaths. Data: CDC NCHS VSRR Provisional Drug Overdose Death Counts.

Team: Derek Pham, Mustafa Hayeri

## Run locally
Static site, no build step:

    python3 -m http.server 8000

Rebuild `data.json` (fetches the CDC data if `data/raw_data.csv` is missing):

    python3 data/build_data.py
