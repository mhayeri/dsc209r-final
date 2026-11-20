import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

// After the Peak - story page. One pass of rough charts straight from data.json,
// plus the one working interaction (pick a state, trace it against the U.S. line).
const [data, us] = await Promise.all([
  d3.json("data.json"),
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json"),
]);

const P = data.periods; // "YYYY-MM", 137 of them
const MONTHS = ["", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const MINUS = "−";
const xOf = (i) => +P[i].slice(0, 4) + (+P[i].slice(5) - 1) / 12; // decimal year
const X = P.map((_, i) => xOf(i));
const yearEnding = (i) => `year ending ${MONTHS[+P[i].slice(5)]} ${P[i].slice(0, 4)}`;
const X_MIN = 2015, X_MAX = 2026.4;

const fmtInt = d3.format(",");
// round half toward zero, matching the static charts (−58.5% reads −58%)
const rnd = (v) => Math.sign(v) * Math.ceil(Math.abs(v) - 0.5);
const pctStr = (v) => (v > 0 ? "+" : v < 0 ? MINUS : "") + Math.abs(rnd(v)) + "%";

// Moose's static-chart palette (Okabe-Ito, colorblind-safe)
const INK = "#1a1a1a", GRAY = "#9aa0a6", BLUE = "#0072b2", ORANGE = "#d55e00";

// change-from-peak shade: 0% -> light, −70% -> dark blue (mirrors static chart 3)
const shade = (v) => {
  const t = Math.max(0, Math.min(1, -v / 70));
  return d3.interpolateBlues(0.12 + 0.82 * t);
};

const yearAxis = (sel, x, H, m) =>
  sel.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.bottom})`)
    .call(d3.axisBottom(x).tickValues(d3.range(2015, 2027)).tickFormat(d3.format("d")));

const tooltip = d3.select("#tooltip");
function showTip(event, html) {
  tooltip.attr("hidden", null).html(html);
  const { offsetWidth: tw, offsetHeight: th } = tooltip.node();
  const left = event.clientX + 14 + tw > innerWidth ? event.clientX - 14 - tw : event.clientX + 14;
  const top = event.clientY + 14 + th > innerHeight ? event.clientY - 14 - th : event.clientY + 14;
  tooltip.style("left", `${Math.max(0, left)}px`).style("top", `${Math.max(0, top)}px`);
}
const hideTip = () => tooltip.attr("hidden", true);

// ---------------------------------------------------------------- Act 1: national trend
function nationalTrend() {
  const s = data.national.total;
  const pk = data.nationalPeak.total;
  const pi = pk.peakIdx;
  const W = 900, H = 420, m = { top: 30, right: 150, bottom: 40, left: 72 };
  const svg = d3.select("#chart-national");
  const x = d3.scaleLinear().domain([X_MIN, X_MAX]).range([m.left, W - m.right]);
  const y = d3.scaleLinear().domain([0, 120000]).range([H - m.bottom, m.top]);

  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")))
    .call((g) => g.selectAll(".tick line").clone().attr("x2", W - m.right - m.left).attr("class", "gridline"));
  yearAxis(svg, x, H, m);
  svg.append("text").attr("class", "axis-label").attr("transform", `translate(16,${(m.top + H - m.bottom) / 2}) rotate(-90)`)
    .attr("text-anchor", "middle").text("deaths in the prior 12 months");

  const pts = s.map((v, i) => ({ x: X[i], v }));
  const line = d3.line().x((d) => x(d.x)).y((d) => y(d.v));
  svg.append("path").datum(pts.slice(0, pi + 1)).attr("class", "pre-peak").attr("d", line);
  svg.append("path").datum(pts.slice(pi)).attr("class", "post-peak").attr("d", line);

  svg.append("circle").attr("class", "peak-dot").attr("r", 4).attr("cx", x(X[pi])).attr("cy", y(s[pi]));
  svg.append("circle").attr("class", "now-dot").attr("r", 4).attr("cx", x(X[s.length - 1])).attr("cy", y(s[s.length - 1]));

  svg.append("text").attr("class", "anno").attr("x", x(X[pi]) - 6).attr("y", y(s[pi]) - 10)
    .attr("text-anchor", "end").attr("font-weight", "700").text(`Peak: ${fmtInt(s[pi])}`);
  svg.append("text").attr("class", "anno").attr("x", x(X[pi]) - 6).attr("y", y(s[pi]) + 4)
    .attr("text-anchor", "end").attr("fill", GRAY).attr("font-size", "10px").text(yearEnding(pi));

  svg.append("text").attr("class", "anno-blue").attr("x", x(2024.9)).attr("y", y(92000))
    .text(`${pctStr(pk.pctChange)} in ${s.length - 1 - pi} months`);

  const nx = x(X[s.length - 1]) + 8;
  svg.append("text").attr("class", "anno").attr("x", nx).attr("y", y(s[s.length - 1]) - 4).attr("font-weight", "700").text(fmtInt(s[s.length - 1]));
  svg.append("text").attr("class", "anno").attr("x", nx).attr("y", y(s[s.length - 1]) + 11).attr("fill", GRAY).attr("font-size", "10px").text(yearEnding(s.length - 1));
}

// ---------------------------------------------------------------- Act 2: drugs indexed to own peak
function drugsIndexed() {
  const spec = [
    ["total", "All overdose deaths", INK],
    ["synthetic", "Synthetic opioids (fentanyl)", ORANGE],
    ["heroin", "Heroin", BLUE],
    ["cocaine", "Cocaine", "#009e73"],
    ["psychostim", "Psychostimulants", "#cc79a7"],
  ];
  const W = 900, H = 420, m = { top: 20, right: 210, bottom: 40, left: 54 };
  const svg = d3.select("#chart-drugs");
  const x = d3.scaleLinear().domain([X_MIN, X_MAX]).range([m.left, W - m.right]);
  const y = d3.scaleLinear().domain([0, 105]).range([H - m.bottom, m.top]);

  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`)
    .call(d3.axisLeft(y).tickValues([0, 25, 50, 75, 100]).tickFormat((d) => d + "%"))
    .call((g) => g.selectAll(".tick line").clone().attr("x2", W - m.right - m.left).attr("class", "gridline"));
  yearAxis(svg, x, H, m);
  svg.append("line").attr("x1", m.left).attr("x2", W - m.right).attr("y1", y(100)).attr("y2", y(100))
    .attr("stroke", "#888").attr("stroke-dasharray", "2 2");
  svg.append("text").attr("class", "axis-label").attr("transform", `translate(14,${(m.top + H - m.bottom) / 2}) rotate(-90)`)
    .attr("text-anchor", "middle").text("12-month deaths, % of own peak");

  const line = d3.line().defined((d) => d.v != null).x((d) => x(d.x)).y((d) => y(d.v));
  // stagger end labels at least 6 points apart
  const ends = spec.map(([k], i) => ({ i, v: data.nationalIndexed[k].at(-1) })).sort((a, b) => a.v - b.v);
  const yEnd = {};
  let prev = -99;
  for (const e of ends) prev = yEnd[e.i] = Math.max(e.v, prev + 6);

  spec.forEach(([k, name, c], i) => {
    const series = data.nationalIndexed[k].map((v, j) => ({ x: X[j], v }));
    svg.append("path").datum(series).attr("class", `drug-line${k === "total" ? " total" : ""}`).attr("stroke", c).attr("d", line);
    const lx = x(X.at(-1));
    svg.append("line").attr("x1", lx).attr("x2", lx + 10).attr("y1", y(data.nationalIndexed[k].at(-1))).attr("y2", y(yEnd[i])).attr("stroke", c).attr("stroke-width", 0.8);
    svg.append("text").attr("class", "drug-label").attr("x", lx + 13).attr("y", y(yEnd[i])).attr("dy", "0.32em").attr("fill", c)
      .text(`${name} ${pctStr(data.nationalPeak[k].pctChange)}`);
  });

  const legend = d3.select("#drug-legend");
  spec.forEach(([, name, c]) => {
    const item = legend.append("span");
    item.append("span").attr("class", "swatch").style("background", c);
    item.append("span").text(name);
  });
}

// ---------------------------------------------------------------- Act 3: map + pick-your-state
const features = topojson.feature(us, us.objects.states).features;
const borders = topojson.mesh(us, us.objects.states, (a, b) => a !== b);
const geoPath = d3.geoPath();
let selected = "West Virginia";

function renderMap() {
  const svg = d3.select("#map");
  svg.append("g").selectAll("path.state").data(features).join("path")
    .attr("class", "state")
    .attr("d", geoPath)
    .attr("fill", (f) => {
      const st = data.statePeak[f.properties.name];
      return st ? shade(st.pctChange) : "#eee";
    })
    .classed("nm-outline", (f) => f.properties.name === "New Mexico")
    .on("mousemove", (event, f) => {
      const st = data.statePeak[f.properties.name];
      showTip(event, `<strong>${f.properties.name}</strong><br>` +
        (st ? `${st.pctChange === 0 ? "at its peak" : pctStr(st.pctChange) + " from peak"}<br><span class="tt-sub">peaked ${yearEnding(st.peakIdx)}</span>` : "no comparable value"));
    })
    .on("mouseleave", hideTip)
    .on("click", (event, f) => { if (data.statePeak[f.properties.name]) selectState(f.properties.name); });
  svg.append("path").datum(borders).attr("class", "borders").attr("d", geoPath);
}

function stateFocus() {
  const name = selected;
  const sp = data.statePeak[name];
  const W = 440, H = 300, m = { top: 18, right: 34, bottom: 28, left: 46 };
  const svg = d3.select("#chart-state");
  svg.selectAll("*").remove();
  const sState = data.rate.total[name];
  const sNat = data.nationalRate.total;
  const x = d3.scaleLinear().domain([X_MIN, X_MAX]).range([m.left, W - m.right]);
  const y = d3.scaleLinear().domain([0, d3.max([...sState, ...sNat].filter((v) => v != null)) * 1.08]).nice().range([H - m.bottom, m.top]);

  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.bottom})`)
    .call(d3.axisBottom(x).tickValues(d3.range(2016, 2027, 2)).tickFormat(d3.format("d")));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5));
  svg.append("text").attr("class", "axis-label").attr("transform", `translate(12,${(m.top + H - m.bottom) / 2}) rotate(-90)`).attr("text-anchor", "middle").text("deaths per 100k");

  const line = d3.line().defined((d) => d.v != null).x((d) => x(d.x)).y((d) => y(d.v));
  svg.append("path").datum(sNat.map((v, i) => ({ x: X[i], v }))).attr("class", "nat-line").attr("d", line);
  svg.append("text").attr("class", "axis-label").attr("x", x(X_MAX)).attr("y", y(sNat.at(-1))).attr("dy", "-0.4em").attr("text-anchor", "end").text("U.S.");
  svg.append("path").datum(sState.map((v, i) => ({ x: X[i], v }))).attr("class", "state-line").attr("d", line);

  if (sp) svg.append("circle").attr("class", "peak-mark").attr("r", 4.5).attr("cx", x(X[sp.peakIdx])).attr("cy", y(sp.ratePeak));

  const nat = data.nationalPeak.total;
  d3.select("#focus-readout").html(
    sp
      ? `<b>${name}</b> peaked at ${sp.ratePeak} per 100k (${yearEnding(sp.peakIdx)}) and is now ${sp.rateNow}, ` +
        `${sp.pctChange === 0 ? "still at its peak" : "down " + Math.abs(rnd(sp.pctChange)) + "%"}. ` +
        `The U.S. is at ${nat.rateNow}, down ${Math.abs(rnd(nat.pctChange))}% from ${nat.ratePeak}.`
      : `<b>${name}</b>: no peak comparison in this build.`
  );
}

function statePicker() {
  const sel = d3.select("#state-pick");
  sel.selectAll("option").data(Object.keys(data.statePeak).sort()).join("option").attr("value", (d) => d).text((d) => d);
  sel.property("value", selected).on("change", (e) => selectState(e.target.value));
}

function selectState(name) {
  selected = name;
  d3.select("#state-pick").property("value", name);
  d3.selectAll("#map .state").classed("selected", (f) => f.properties.name === name);
  stateFocus();
}

// ---------------------------------------------------------------- Act 4: slope chart (rough)
function slopeChart() {
  const entries = Object.entries(data.statePeak); // [name, {ratePeak, rateNow, pctChange,...}]
  const W = 900, H = 460, m = { top: 24, right: 150, bottom: 30, left: 150 };
  const svg = d3.select("#chart-slope");
  const xL = m.left + 60, xR = W - m.right - 60;
  const y = d3.scaleLinear().domain([0, d3.max(entries, ([, v]) => v.ratePeak) * 1.05]).nice().range([H - m.bottom, m.top]);
  svg.append("g").attr("class", "axis").attr("transform", `translate(${xL},0)`).call(d3.axisLeft(y).ticks(6));
  svg.append("text").attr("class", "axis-label").attr("x", xL).attr("y", m.top - 8).attr("text-anchor", "middle").text("at peak");
  svg.append("text").attr("class", "axis-label").attr("x", xR).attr("y", m.top - 8).attr("text-anchor", "middle").text("now");
  svg.append("text").attr("class", "axis-label").attr("transform", `translate(${xL - 44},${(m.top + H - m.bottom) / 2}) rotate(-90)`).attr("text-anchor", "middle").text("deaths per 100k");

  // all states as faint background slopes
  entries.forEach(([, v]) => {
    svg.append("line").attr("class", "slope-bg").attr("x1", xL).attr("y1", y(v.ratePeak)).attr("x2", xR).attr("y2", y(v.rateNow));
  });

  // highlight the 5 biggest drops + the one state still at peak
  const byDrop = [...entries].sort((a, b) => a[1].pctChange - b[1].pctChange);
  const hi = byDrop.slice(0, 5).concat(byDrop.filter(([, v]) => v.pctChange === 0));
  // stagger right-side labels
  const lab = hi.map(([name, v]) => ({ name, v, y: y(v.rateNow) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < lab.length; k++) if (lab[k].y - lab[k - 1].y < 13) lab[k].y = lab[k - 1].y + 13;
  const labY = Object.fromEntries(lab.map((d) => [d.name, d.y]));
  hi.forEach(([name, v]) => {
    const c = v.pctChange === 0 ? ORANGE : BLUE;
    svg.append("line").attr("class", "slope-hi").attr("stroke", c).attr("x1", xL).attr("y1", y(v.ratePeak)).attr("x2", xR).attr("y2", y(v.rateNow));
    svg.append("circle").attr("class", "slope-dot").attr("fill", c).attr("r", 3.5).attr("cx", xL).attr("cy", y(v.ratePeak));
    svg.append("circle").attr("class", "slope-dot").attr("fill", c).attr("r", 3.5).attr("cx", xR).attr("cy", y(v.rateNow));
    svg.append("text").attr("class", "slope-label").attr("fill", c).attr("x", xR + 8).attr("y", labY[name]).attr("dy", "0.32em")
      .text(`${name} ${pctStr(v.pctChange)}`);
    svg.append("text").attr("class", "slope-label").attr("fill", GRAY).attr("x", xL - 8).attr("y", y(v.ratePeak)).attr("dy", "0.32em").attr("text-anchor", "end").text(v.ratePeak);
  });
}

// ---------------------------------------------------------------- Act 5: small multiples (rough)
function smallMultiples() {
  const entries = Object.entries(data.statePeak);
  const byDrop = [...entries].sort((a, b) => a[1].pctChange - b[1].pctChange);
  const drops = byDrop.slice(0, 5);
  const highs = byDrop.slice(-5).reverse(); // closest to peak first (incl. NM)
  const host = d3.select("#multiples");
  const W = 170, H = 78, m = { top: 8, right: 8, bottom: 6, left: 8 };
  const yMax = d3.max(entries, ([, v]) => v.ratePeak);

  const draw = (name, v, cls) => {
    const div = host.append("div").attr("class", `mini ${cls}`);
    div.append("h4").text(name);
    div.append("div").attr("class", "sub").html(`${pctStr(v.pctChange)} &middot; peak ${P[v.peakIdx].slice(0, 4)}`);
    const svg = div.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const s = data.rate.total[name];
    const x = d3.scaleLinear().domain([X_MIN, X_MAX]).range([m.left, W - m.right]);
    const y = d3.scaleLinear().domain([0, yMax]).range([H - m.bottom, m.top]);
    const line = d3.line().defined((d) => d.v != null).x((d) => x(d.x)).y((d) => y(d.v));
    svg.append("path").datum(s.map((val, i) => ({ x: X[i], v: val }))).attr("class", "spark").attr("d", line);
    svg.append("circle").attr("class", "spark-dot").attr("r", 2.6).attr("cx", x(X[v.peakIdx])).attr("cy", y(v.ratePeak));
  };
  drops.forEach(([name, v]) => draw(name, v, "mini-drop"));
  highs.forEach(([name, v]) => draw(name, v, "mini-high"));
}

// ---------------------------------------------------------------- Act 6: peak timing (rough)
function peakTiming() {
  const entries = Object.entries(data.statePeak);
  const W = 900, H = 360, m = { top: 20, right: 30, bottom: 40, left: 54 };
  const svg = d3.select("#chart-timing");
  const x = d3.scaleLinear().domain([2016.5, X_MAX]).range([m.left, W - m.right]);
  const y = d3.scaleLinear().domain([0, d3.max(entries, ([, v]) => v.ratePeak) * 1.05]).nice().range([H - m.bottom, m.top]);
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.bottom})`).call(d3.axisBottom(x).tickValues(d3.range(2017, 2027)).tickFormat(d3.format("d")));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(6));
  svg.append("text").attr("class", "axis-label").attr("transform", `translate(14,${(m.top + H - m.bottom) / 2}) rotate(-90)`).attr("text-anchor", "middle").text("death rate per 100k at peak");
  svg.append("text").attr("class", "axis-label").attr("x", (m.left + W - m.right) / 2).attr("y", H - 4).attr("text-anchor", "middle").text("month the state peaked");

  svg.append("g").selectAll("circle").data(entries).join("circle")
    .attr("cx", ([, v]) => x(xOf(v.peakIdx)))
    .attr("cy", ([, v]) => y(v.ratePeak))
    .attr("r", 4.5)
    .attr("fill", ([, v]) => (v.pctChange === 0 ? ORANGE : shade(v.pctChange)))
    .attr("stroke", "#fff").attr("stroke-width", 0.8)
    .on("mousemove", (event, [name, v]) => showTip(event, `<strong>${name}</strong><br>peaked ${yearEnding(v.peakIdx)}<br><span class="tt-sub">${v.ratePeak} per 100k, ${pctStr(v.pctChange)} since</span>`))
    .on("mouseleave", hideTip);

  // label a few anchors
  const labels = { "Pennsylvania": [6, -8], "West Virginia": [8, -2], "New Mexico": [-8, -8], "Ohio": [6, 10] };
  entries.filter(([n]) => labels[n]).forEach(([name, v]) => {
    const [dx, dy] = labels[name];
    svg.append("text").attr("class", "slope-label").attr("fill", INK)
      .attr("x", x(xOf(v.peakIdx)) + dx).attr("y", y(v.ratePeak) + dy)
      .attr("text-anchor", dx < 0 ? "end" : "start").text(name);
  });
}

// ---------------------------------------------------------------- go
nationalTrend();
drugsIndexed();
renderMap();
statePicker();
slopeChart();
smallMultiples();
peakTiming();
selectState(selected);
