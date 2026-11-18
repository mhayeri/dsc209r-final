#!/usr/bin/env python3
"""Static charts 1-3 for the final-project proposal, drawn from ../data.json.

    python3 charts/static_charts.py

Writes charts/1_national_trend.png, 2_drugs_by_own_peak.png, 3_change_from_peak_map.png.
"""
import json
import math
import os

import matplotlib.pyplot as plt
from matplotlib import colors
from matplotlib.patches import Rectangle

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "..", "data.json")))
P = D["periods"]
X = [int(p[:4]) + (int(p[5:]) - 1) / 12 for p in P]  # decimal year of each period
MONTH = ["", "January", "February", "March", "April", "May", "June", "July",
         "August", "September", "October", "November", "December"]
SOURCE = ("Source: CDC NCHS, VSRR Provisional Drug Overdose Death Counts "
          "(12-month-ending counts, provisional, through May 2026).")
INK, GRAY, BLUE = "#222222", "#9aa0a6", "#0072b2"

plt.rcParams.update({"font.family": "DejaVu Sans", "axes.spines.top": False,
                     "axes.spines.right": False, "axes.edgecolor": "#444444"})


def rnd(v):
    # round half toward zero, so a -49.5% change reads -49% (matches the proposal)
    return int(math.copysign(math.ceil(abs(v) - 0.5), v))


def label(i):
    return f"{MONTH[int(P[i][5:])]} {P[i][:4]}"


def header(fig, title, sub):
    fig.text(0.02, 0.97, title, fontsize=15, fontweight="bold", color=INK, va="top")
    fig.text(0.02, 0.905, sub, fontsize=9, color="#666666", va="top", linespacing=1.4)


def footer(fig, extra=""):
    fig.text(0.02, 0.02, SOURCE + extra, fontsize=7.5, color="#777777", va="bottom",
             linespacing=1.4)


# ---------------------------------------------------------------- chart 1
def chart1():
    s = D["national"]["total"]
    pk = D["nationalPeak"]["total"]
    pi, now = pk["peakIdx"], pk["now"]
    # titles below name these literally; fail loudly if a data refresh changes them
    assert P[-1] == "2026-05" and P[pi] == "2023-06", (P[-1], P[pi])
    # first month whose 12-month total is within 0.5% of today's, for the "back to" line
    back = next(i for i, v in enumerate(s) if v and abs(v - now) / now < 0.005)
    fig = plt.figure(figsize=(9, 5.6))
    header(fig, f"U.S. overdose deaths have fallen {abs(rnd(pk['pctChange']))}% since mid-2023",
           "Drug overdose deaths in the 12 months ending each month, January 2015 to "
           f"May 2026. After the peak in the\nyear ending {label(pi)}, the total fell "
           f"over the next {len(P) - 1 - pi} months and is back to about where it was in "
           f"early {P[back][:4]}.")
    ax = fig.add_axes([0.11, 0.14, 0.72, 0.62])
    ax.plot(X[: pi + 1], s[: pi + 1], color=GRAY, lw=2)
    ax.plot(X[pi:], s[pi:], color=BLUE, lw=3)
    ax.scatter([X[pi]], [pk["peak"]], color=INK, zorder=5, s=30)
    ax.scatter([X[-1]], [now], color=BLUE, zorder=5, s=30)
    ax.hlines(pk["peak"], X[pi], X[-1] + 0.4, color="#444444", ls=":", lw=1)
    ax.hlines(now, X[back], X[-1], color="#444444", ls="--", lw=1)
    ax.text(X[pi] - 0.2, pk["peak"] + 4000, f"Peak: {pk['peak']:,} (year ending {label(pi)})",
            ha="right", fontsize=9, fontweight="bold", color=INK)
    ax.text((X[back] + X[-1]) / 2, now - 8000,
            f"Same level as the year ending {label(back)} ({s[back]:,})",
            ha="center", fontsize=8.5, color="#555555")
    ax.annotate("", xy=(X[-1] + 0.4, now), xytext=(X[-1] + 0.4, pk["peak"]),
                arrowprops=dict(arrowstyle="-|>", color=BLUE, lw=1.5), annotation_clip=False)
    ax.text(X[-1] + 0.6, (pk["peak"] + now) / 2 + 12000,
            f"{rnd(pk['pctChange'])}%\nin {len(P) - 1 - pi}\nmonths".replace("-", "−"),
            color=BLUE, fontsize=11, fontweight="bold", va="center", linespacing=1.2)
    ax.text(X[-1] + 0.5, now - 3000, f"{now:,}\n(year ending\n{label(len(P) - 1)})",
            fontsize=8, va="top", color=INK, linespacing=1.2)
    ax.set_xlim(2015, 2026.6)
    ax.set_ylim(0, 125000)
    ax.set_xticks(range(2015, 2027))
    ax.set_yticks(range(0, 125001, 25000))
    ax.set_yticklabels([f"{v:,}" for v in range(0, 125001, 25000)])
    ax.grid(axis="y", color="#e5e5e5")
    ax.set_axisbelow(True)
    ax.set_xlabel("Last month of each 12-month window")
    ax.set_ylabel("Deaths in the prior 12 months")
    footer(fig)
    fig.savefig(os.path.join(HERE, "1_national_trend.png"), dpi=150)


# ---------------------------------------------------------------- chart 2
def chart2():
    spec = [("psychostim", "Psychostimulants (incl. meth)", "#cc79a7"),
            ("cocaine", "Cocaine", "#009e73"),
            ("total", "All overdose deaths", INK),
            ("synthetic", "Synthetic opioids (fentanyl)", "#d55e00"),
            ("heroin", "Heroin", BLUE)]
    fig = plt.figure(figsize=(9, 5.8))
    header(fig, "Fentanyl deaths are down "
           f"{abs(rnd(D['nationalPeak']['synthetic']['pctChange']))}% from peak, heroin down "
           f"{abs(rnd(D['nationalPeak']['heroin']['pctChange']))}%",
           "Each drug's 12-month death count as a percent of its own peak (peak = 100). One "
           "death can involve\nmore than one drug and then counts under each, so the lines "
           "can't be added together.")
    ax = fig.add_axes([0.10, 0.14, 0.52, 0.62])
    ends = sorted((D["nationalIndexed"][k][-1], i) for i, (k, _, _) in enumerate(spec))
    ypos, prev = {}, -99
    for y, i in ends:  # keep end labels at least 5 points apart
        prev = ypos[i] = max(y, prev + 5)
    for i, (k, name, c) in enumerate(spec):
        y = D["nationalIndexed"][k]
        ax.plot(X, y, color=c, lw=3 if k == "total" else 2)
        pct = rnd(D["nationalPeak"][k]["pctChange"])
        ax.plot([X[-1], X[-1] + 0.12], [y[-1], ypos[i]], color=c, lw=0.8)
        ax.text(X[-1] + 0.15, ypos[i], f"{name} {pct}%".replace("-", "−"), color=c,
                fontsize=9, fontweight="bold", va="center")
    hp = D["nationalPeak"]["heroin"]["peakIdx"]
    ax.scatter([X[hp]], [100], color=BLUE, s=25, zorder=5)
    ax.text(X[hp] + 0.3, 105, f"Heroin peak, {label(hp)}", color=BLUE, fontsize=8.5)
    ax.axhline(100, color="#444444", ls=":", lw=1)
    ax.set_xlim(2015, 2026.4)
    ax.set_ylim(0, 112)
    ax.set_xticks(range(2015, 2026, 2))
    ax.set_yticks([0, 25, 50, 75, 100])
    ax.grid(axis="y", color="#e5e5e5")
    ax.set_axisbelow(True)
    ax.set_xlabel("Last month of each 12-month window")
    ax.set_ylabel("12-month deaths, % of own peak")
    footer(fig)
    fig.savefig(os.path.join(HERE, "2_drugs_by_own_peak.png"), dpi=150)


# ---------------------------------------------------------------- chart 3
# (row, col) of each state in a tile-grid map of the U.S.
TILES = {
    "AK": (0, 0), "ME": (0, 10), "VT": (1, 9), "NH": (1, 10),
    "WA": (2, 0), "ID": (2, 1), "MT": (2, 2), "ND": (2, 3), "MN": (2, 4), "IL": (2, 5),
    "WI": (2, 6), "MI": (2, 7), "NY": (2, 8), "RI": (2, 9), "MA": (2, 10),
    "OR": (3, 0), "NV": (3, 1), "WY": (3, 2), "SD": (3, 3), "IA": (3, 4), "IN": (3, 5),
    "OH": (3, 6), "PA": (3, 7), "NJ": (3, 8), "CT": (3, 9),
    "CA": (4, 0), "UT": (4, 1), "CO": (4, 2), "NE": (4, 3), "MO": (4, 4), "KY": (4, 5),
    "WV": (4, 6), "VA": (4, 7), "MD": (4, 8), "DE": (4, 9),
    "AZ": (5, 1), "NM": (5, 2), "KS": (5, 3), "AR": (5, 4), "TN": (5, 5), "NC": (5, 6),
    "SC": (5, 7), "DC": (5, 8),
    "OK": (6, 3), "LA": (6, 4), "MS": (6, 5), "AL": (6, 6), "GA": (6, 7),
    "HI": (7, 0), "TX": (7, 3), "FL": (7, 8),
}
ABBR = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "District of Columbia": "DC",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL",
    "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI",
    "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO", "Montana": "MT",
    "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
    "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA",
    "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN",
    "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
    "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
}


def chart3():
    sp = D["statePeak"]
    pct = {ABBR[s]: v["pctChange"] for s, v in sp.items()}
    assert set(pct) == set(TILES), set(pct) ^ set(TILES)  # every state has a tile
    us = D["nationalPeak"]["total"]["pctChange"]
    further = sum(1 for v in pct.values() if v < us)
    at_peak = [a for a, v in pct.items() if v == 0]
    cmap = plt.get_cmap("Blues_r")
    norm = colors.Normalize(vmin=-70, vmax=0)
    shade = lambda v: cmap(0.05 + 0.85 * (norm(v)))  # keep the lightest tile off pure white
    fig = plt.figure(figsize=(9, 6.4))
    low = min(pct, key=pct.get)
    assert low == "OR" and at_peak == ["NM"], (low, at_peak)  # named in the title
    pk_idx = [v["peakIdx"] for v in sp.values()]
    span = f"{P[min(pk_idx)][:4]} to {P[max(pk_idx)][:4]}"
    header(fig, f"Oregon is down {abs(rnd(pct[low]))}% from its peak; New Mexico is at a new high",
           "Change in each state's 12-month overdose deaths, from its own peak month to the "
           f"year ending May 2026.\n{further} of the 50 states and D.C. fell further than the "
           f"U.S. did ({rnd(us)}%). New Mexico (outlined) is at its\nhighest 12-month total "
           f"in the data. States peaked at different times, from {span}, "
           "so the windows differ.".replace("(-", "(−"))
    ax = fig.add_axes([0.04, 0.1, 0.72, 0.72])
    for a, (r, c) in TILES.items():
        v = pct[a]
        ax.add_patch(Rectangle((c, -r), 0.92, 0.92, color=shade(v), lw=0))
        if a in at_peak:
            ax.add_patch(Rectangle((c, -r), 0.92, 0.92, fill=False, ec="#d55e00", lw=2.5))
        dark = norm(v) < 0.45
        ax.text(c + 0.46, -r + 0.58, a, ha="center", va="center", fontsize=9,
                fontweight="bold", color="white" if dark else INK)
        ax.text(c + 0.46, -r + 0.25, f"{rnd(v)}%".replace("-", "−"), ha="center",
                va="center", fontsize=7, color="white" if dark else INK)
    ax.set_xlim(-0.1, 11.1)
    ax.set_ylim(-7.1, 1.0)
    ax.set_aspect("equal")
    ax.axis("off")
    cax = fig.add_axes([0.84, 0.18, 0.025, 0.5])
    grad = [[norm.inverse(1 - i / 99)] for i in range(100)]
    cax.imshow([[shade(v)] for v, in grad][::-1][::-1], aspect="auto",
               extent=[0, 1, -70, 0])
    cax.set_xticks([])
    cax.yaxis.tick_right()
    cax.set_yticks(range(-70, 1, 10))
    cax.set_yticklabels([f"{v}%".replace("-", "−") for v in range(-70, 1, 10)], fontsize=8)
    for sp_ in cax.spines.values():
        sp_.set_visible(False)
    cax.hlines(us, -0.3, 1, color=INK, lw=1.5, clip_on=False)
    cax.text(-0.5, us, f"U.S.\n{rnd(us)}%".replace("-", "−"), ha="right", va="center",
             fontsize=8.5, fontweight="bold")
    fig.text(0.855, 0.72, "Change from\nown peak", ha="center", fontsize=8.5)
    footer(fig, "\n50 states and D.C.; New York includes New York City.")
    fig.savefig(os.path.join(HERE, "3_change_from_peak_map.png"), dpi=150)


if __name__ == "__main__":
    chart1()
    chart2()
    chart3()
    print("wrote 3 charts to", HERE)
