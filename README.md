# ⚡ BijliCut

A lightweight, highly shareable web app for Pakistani citizens to:

- 🧮 **Calculate electricity bills** using NEPRA residential tariff slabs
- 📊 **Understand tariff slabs** with a transparent, line-by-line breakdown
- ☀️ **Estimate solar panel requirements** to offset their usage
- ⏱️ **Optimize peak-hour usage** to cut down on Time-of-Use charges

It's a single static page — no build step, no backend, no tracking. Just open `index.html`.

## Running locally

```bash
# Any static server works. For example:
npx serve .
# or simply open index.html in a browser
```

## Project structure

```
BijliCut/
├── index.html      # The entire app (HTML + CSS + JS)
├── README.md
└── .gitignore
```

## ⚠️ Disclaimer

Tariff rates, taxes, and surcharges are **indicative** and change frequently via
NEPRA notifications and monthly Fuel Cost Adjustments (FCA). Always confirm the
exact figures against your official DISCO bill. The rates in this app live in the
`TARIFF` object inside `index.html` and are easy to update.

## Roadmap

- [ ] Per-DISCO tariff presets (LESCO, K-Electric, IESCO, etc.)
- [ ] Fuel Cost Adjustment (FCA) and Quarterly Tariff Adjustment inputs
- [ ] Shareable result links / image export for virality
- [ ] Urdu language toggle
