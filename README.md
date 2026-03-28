# ⚔️ Azeroth's Most Wanted Armory

![GitHub Actions](https://img.shields.io/badge/Automated-GitHub%20Actions-2088FF?style=for-the-badge&logo=github)
![Python](https://img.shields.io/badge/Python-3.10-3776AB?style=for-the-badge&logo=python)
![Turso](https://img.shields.io/badge/Turso-Edge%20Database-41D0B6?style=for-the-badge&logo=sqlite)
![Jinja2](https://img.shields.io/badge/Jinja2-Static%20Gen-B41717?style=for-the-badge)

A fully automated, high-performance static dashboard providing dynamic equipment, stats, and loot history for the World of Warcraft Classic guild **Azeroth's Most Wanted** (Thunderstrike). 

This project was built to demonstrate how to process thousands of API data points daily and render complex historical analytics **without a traditional backend or any recurring hosting fees.**

🔗 **[View the Live Dashboard](https://codenode-automation.github.io/Azeroths-Most-Wanted/)**

---

## ⚡ System Architecture: 100% Free & Serverless

Azeroth's Most Wanted Armory operates on a fully automated, zero-cost tech stack. By combining edge databases, static site generation, and GitHub Actions, the system achieves maximum uptime and zero database latency on the client side.

<div align="center">

### 1️⃣ EXTRACTION: Asynchronous Pull
<img src="asset/software_logo/python.png" height="50" alt="Python">

Python utilizes **AsyncIO** and **Aiohttp** to concurrently fetch live character profiles from the Blizzard REST API. A semaphore system acts as a bouncer to respect API rate limits while processing vast amounts of data in seconds.

⬇️

### 2️⃣ STORAGE: Edge Database
<img src="asset/software_logo/turso.png" height="50" alt="Turso"> &nbsp;&nbsp;&nbsp; <img src="asset/software_logo/sqlite.png" height="50" alt="SQLite">

Processed data is pushed in chunked, bulk transactions to a **Turso** edge database (libSQL/SQLite) using direct REST API calls. This avoids driver bottlenecks and allows for infinite, free storage of historical guild trends and loot timelines.

⬇️

### 3️⃣ AUTOMATION: CI/CD Pipeline
<img src="asset/software_logo/github.png" height="50" alt="GitHub"> &nbsp;&nbsp;&nbsp; <img src="asset/software_logo/cron.png" height="50" alt="Cron">

**GitHub Actions** acts as the server. A strict **Cron** schedule (or manual dispatch) triggers the workflow pipeline to authenticate, fetch API updates, push to the database, and rebuild the website without human intervention.

⬇️

### 4️⃣ COMPILATION: Static Generation
<img src="asset/software_logo/jinga.png" height="50" alt="Jinja2"> &nbsp;&nbsp;&nbsp; <img src="asset/software_logo/html5.png" height="50" alt="HTML5">

**Jinja2** templates ingest the latest database queries to dynamically generate raw HTML. The result is a lightning-fast, ultra-secure static frontend powered by HTML5 and modern CSS (bypassing the need for a Node.js framework).

⬇️

### 5️⃣ VISUALIZATION: Client-Side Rendering
<img src="asset/software_logo/json.png" height="50" alt="JSON">

Heavy payloads, like the thousands of lines of timeline activity, are pre-compiled into static **JSON** files (`timeline.json`, `roster.json`). The frontend consumes this data natively, using **Chart.js** to render heatmaps and analytics with zero database latency.

</div>

---

*Disclaimer: World of Warcraft, Warcraft and Blizzard Entertainment are trademarks or registered trademarks of Blizzard Entertainment, Inc. in the U.S. and/or other countries. This is a portfolio/community project and is not affiliated with, endorsed, or sponsored by Blizzard Entertainment.*
