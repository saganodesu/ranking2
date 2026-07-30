document.getElementById('fileBtn').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  document.getElementById('fileName').textContent = file ? file.name : "";
});

document.getElementById('fileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    document.getElementById('logInput').value = event.target.result;
  };
  reader.readAsText(file, 'UTF-8');
});

function toHalfWidth(str) {
  return str.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
            .replace(/　/g, " ");
}

function parseMinutes(text) {
  text = toHalfWidth(text);

  const halfMatch = text.match(/(\d+)時間半/);
  if (halfMatch) return Number(halfMatch[1]) * 60 + 30;

  const hm = text.match(/(\d+)時間\s*(\d+)分/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);

  const h = text.match(/(\d+)時間/);
  if (h) return Number(h[1]) * 60;

  const m = text.match(/(\d+)分/);
  if (m) return Number(m[1]);

  return 0;
}

function parseAllLogs(rawText) {
  const lines = rawText.split('\n').map(l => l.trim());
  const allReports = [];

  let currentDate = null;

  const dateLineRegex = /^(\d{4})[./](\d{1,2})[./](\d{1,2})/;
  const schoolRegex = /(学校あり|学校アリ|ｶﾞｯｺｳｱﾘ|ガッコウアリ)/;
  const examRegex = /受験生/;

  for (let i = 0; i < lines.length; i++) {
    let line = toHalfWidth(lines[i]);

    const d = line.match(dateLineRegex);
    if (d) {
      const y = d[1];
      const m = d[2].padStart(2, "0");
      const day = d[3].padStart(2, "0");
      currentDate = `${y}-${m}-${day}`;
      continue;
    }

    if (line.includes("勉強時間報告")) {
      if (!currentDate) continue;

      const timeMatch = line.match(/^(\d{1,2}):(\d{2})/);
      if (!timeMatch) continue;

      const hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2]);

      let afterTime = line.replace(/^\d{1,2}:\d{2}\s*/, "");
      afterTime = afterTime.replace(/勉強時間報告(?=[0-9０-９半])/g, "勉強時間報告 ");

      const beforeReport = afterTime.split("勉強時間報告")[0].trim();
      const name = beforeReport;

      let blockLines = [line];
      for (let j = i + 1; j < lines.length; j++) {
        const l = toHalfWidth(lines[j]);

        if (/^\d{1,2}:\d{2}/.test(l)) break;
        if (dateLineRegex.test(l)) break;

        blockLines.push(l);
      }

      const block = blockLines.join(" ");

      const minutes = parseMinutes(block);
      if (minutes === 0) continue;

      const school = schoolRegex.test(block);
      const exam = examRegex.test(block);

      let msgDate = new Date(`${currentDate}T00:00:00`);
      msgDate.setHours(hour, minute, 0, 0);

      allReports.push({
        name,
        minutes,
        date: msgDate,
        school,
        exam
      });
    }
  }

  return allReports;
}

function getDailyRange(targetDateStr) {
  const start = new Date(`${targetDateStr}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(6, 0, 0, 0);
  return { start, end };
}

function getMonthlyRanges(targetDateStr) {
  const target = new Date(`${targetDateStr}T00:00:00`);
  const year = target.getFullYear();
  const month = target.getMonth();

  const ranges = [];

  for (let day = 1; day <= target.getDate(); day++) {
    const d = new Date(year, month, day);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    ranges.push(getDailyRange(`${yyyy}-${mm}-${dd}`));
  }

  return ranges;
}

document.getElementById('calcBtn').addEventListener('click', () => {
  let raw = document.getElementById('logInput').value;
  const targetDateStr = document.getElementById('targetDate').value;

  raw = raw.replace(/["“”]/g, "");

  if (!raw.trim()) {
    alert('ログを入力するか、ファイルを読み込んでください');
    return;
  }

  if (!targetDateStr) {
    alert('対象日を選択してください');
    return;
  }

  const allReports = parseAllLogs(raw);

  const { start, end } = getDailyRange(targetDateStr);

  const latestToday = {};
  allReports.forEach(r => {
    if (r.date >= start && r.date <= end) {
      latestToday[r.name] = r;
    }
  });

  const todayEntries = Object.values(latestToday).sort((a, b) => b.minutes - a.minutes);

  const monthlyRanges = getMonthlyRanges(targetDateStr);

  const monthlyTotals = {};

  // ★ 月間は「合計」
  monthlyRanges.forEach(range => {
    const daily = {};

    allReports.forEach(r => {
      if (r.date >= range.start && r.date <= range.end) {
        daily[r.name] = (daily[r.name] || 0) + r.minutes;
      }
    });

    for (const name in daily) {
      monthlyTotals[name] = (monthlyTotals[name] || 0) + daily[name];
    }
  });

  const d = new Date(targetDateStr);
  const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;

  let text = "";

  text += `総合ランキング ${dateLabel}\n`;
  todayEntries.forEach((r, i) => {
    const h = Math.floor(r.minutes / 60);
    const m = r.minutes % 60;
    const monthH = Math.floor((monthlyTotals[r.name] || 0) / 60);

    text += `${i + 1}位 ${r.name}：${h}時間${m}分　(${monthH}h)\n`;
  });

  text += `\n※括弧内は今月の合計勉強時間です`;

  document.getElementById('resultText').textContent = text;
});

document.getElementById('copyBtn').addEventListener('click', () => {
  const text = document.getElementById('resultText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const msg = document.getElementById('copyMsg');
    msg.style.display = "inline";
    setTimeout(() => msg.style.display = "none", 1500);
  });
});

window.addEventListener("load", () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const target = document.getElementById("targetDate");
  if (target) target.value = `${yyyy}-${mm}-${dd}`;
});

