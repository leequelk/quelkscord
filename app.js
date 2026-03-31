(function () {
  const grouped = window.__ARCHIVE_DATA__;
  if (!grouped || !grouped.months) {
    console.error("Archive data is missing.");
    return;
  }

  const browserEl = document.getElementById("browser");
  const viewerEl = document.getElementById("viewer");
  const nicknameSearchEl = document.getElementById("nicknameSearch");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const searchResultsEl = document.getElementById("searchResults");
  const searchResultsListEl = document.getElementById("searchResultsList");
  const searchSummaryEl = document.getElementById("searchSummary");
  const topbarHelperEl = document.getElementById("topbarHelper");

  let activeWeekKey = null;
  let activeMessageId = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\\"/g, "&quot;");
  }

  function linkify(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function decorateMentions(text) {
    return linkify(text).replace(/(^|\s)(@[^\s]+)/g, (match, prefix, mention) => {
      return `${prefix}<span class="mention">${mention}</span>`;
    });
  }

  function allWeeks() {
    const weeks = [];
    grouped.months.forEach(month => {
      month.weeks.forEach(week => {
        weeks.push(week);
      });
    });
    return weeks;
  }

  function buildSearchIndex() {
    const rows = [];
    grouped.months.forEach(month => {
      month.weeks.forEach(week => {
        week.messages.forEach(message => {
          rows.push({
            id: message.id,
            author: message.author,
            author_color: message.author_color,
            content: message.content || "",
            time: message.time,
            date_label: message.date_label,
            week_key: week.key,
            week_label: week.label
          });
        });
      });
    });
    return rows;
  }

  const searchIndex = buildSearchIndex();

  function renderBrowser() {
    browserEl.innerHTML = "";

    grouped.months.forEach(month => {
      const monthDetails = document.createElement("details");
      monthDetails.innerHTML = `
        <summary>
          <span>${escapeHtml(month.label)}</span>
          <span class="count">${month.count.toLocaleString()}개</span>
        </summary>
      `;

      const weekList = document.createElement("div");
      weekList.className = "week-list";

      month.weeks.forEach(week => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "week-btn";
        btn.dataset.weekKey = week.key;
        btn.textContent = `${week.label} · ${week.count.toLocaleString()}개 · ${week.day_count}일`;

        btn.addEventListener("click", () => {
          setActiveWeekButton(week.key);
          renderWeek(week);
        });

        weekList.appendChild(btn);
      });

      monthDetails.appendChild(weekList);
      browserEl.appendChild(monthDetails);
    });
  }

  function setActiveWeekButton(weekKey) {
    activeWeekKey = weekKey;
    document.querySelectorAll(".week-btn").forEach(el => {
      el.classList.toggle("active", el.dataset.weekKey === weekKey);
    });
  }

  function renderMessage(message) {
    const article = document.createElement("article");
    article.className = "message";
    article.dataset.messageId = message.id || "";

    const badgesHtml = (message.badges || [])
      .map(b => `<span class="badge">${escapeHtml(b)}</span>`)
      .join("");

    let replyHtml = "";
    if (message.reply_preview) {
      replyHtml = `
        <div class="reply">
          <div class="reply-author">${escapeHtml(message.reply_preview.author)}</div>
          <div>${escapeHtml(message.reply_preview.content)}</div>
        </div>
      `;
    }

    const lines = (message.content || "").split(/\n/).map(line => line.trimEnd());
    const contentHtml = lines.length
      ? lines.map(line => {
          if (!line) return '<div class="line empty"></div>';
          return `<div class="line">${decorateMentions(line)}</div>`;
        }).join("")
      : "";

    const attachmentsHtml = (message.attachment_links || []).length
      ? `<div class="attachments">${
          message.attachment_links.map(url =>
            `<a class="attachment-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">첨부 링크</a>`
          ).join("")
        }</div>`
      : "";

    article.innerHTML = `
      <div class="meta">
        <span class="author" style="color:${escapeHtml(message.author_color)}">${escapeHtml(message.author)}</span>
        <span class="time">${escapeHtml(message.time)}</span>
        <div class="badges">${badgesHtml}</div>
      </div>
      ${replyHtml}
      <div class="content">${contentHtml}</div>
      ${attachmentsHtml}
    `;

    return article;
  }

  function renderWeek(week) {
    viewerEl.innerHTML = "";
    viewerEl.scrollTop = 0;

    const top = document.createElement("div");
    top.className = "viewer-top";
    top.innerHTML = `
      <div>
        <div class="viewer-title">${escapeHtml(week.label)}</div>
        <div class="viewer-meta">메시지 ${week.count.toLocaleString()}개 · ${week.day_count}일</div>
      </div>
    `;
    viewerEl.appendChild(top);

    let currentDate = null;
    week.messages.forEach(message => {
      if (message.date_key !== currentDate) {
        currentDate = message.date_key;
        const divider = document.createElement("div");
        divider.className = "date-divider";
        divider.textContent = message.date_label;
        viewerEl.appendChild(divider);
      }
      viewerEl.appendChild(renderMessage(message));
    });

    if (activeMessageId) {
      requestAnimationFrame(() => {
        jumpToRenderedMessage(activeMessageId);
      });
    }
  }

  function jumpToRenderedMessage(messageId) {
    const el = viewerEl.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("highlight");

    setTimeout(() => {
      el.classList.remove("highlight");
    }, 2200);
  }

  function openMonthContainingWeek(weekKey) {
    document.querySelectorAll(".browser details").forEach(details => {
      const hasWeek = details.querySelector(`.week-btn[data-week-key="${CSS.escape(weekKey)}"]`);
      if (hasWeek) {
        details.open = true;
      }
    });
  }

  function jumpToMessage(result) {
    activeMessageId = result.id;

    const week = allWeeks().find(w => w.key === result.week_key);
    if (!week) return;

    openMonthContainingWeek(result.week_key);
    setActiveWeekButton(result.week_key);
    renderWeek(week);
  }

  function makePreview(text, maxLen = 90) {
    const oneLine = String(text || "").replace(/\s+/g, " ").trim();
    if (!oneLine) return "(내용 없음)";
    if (oneLine.length <= maxLen) return oneLine;
    return oneLine.slice(0, maxLen) + "…";
  }

  function runNicknameSearch() {
    const q = nicknameSearchEl.value.trim().toLowerCase();

    if (!q) {
      searchResultsEl.classList.remove("show");
      searchResultsListEl.innerHTML = "";
      searchSummaryEl.textContent = "검색 결과";
      topbarHelperEl.textContent = "닉네임을 입력하면 그 사람이 보낸 메시지 목록이 뜹니다.";
      return;
    }

    const results = searchIndex
      .filter(item => item.author.toLowerCase().includes(q))
      .slice(0, 120);

    searchResultsEl.classList.add("show");
    searchResultsListEl.innerHTML = "";

    searchSummaryEl.textContent = `검색 결과 ${results.length.toLocaleString()}개`;

    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "placeholder";
      empty.style.padding = "20px 8px";
      empty.textContent = "해당 닉네임으로 찾은 메시지가 없습니다.";
      searchResultsListEl.appendChild(empty);
      topbarHelperEl.textContent = "검색 결과가 없습니다.";
      return;
    }

    topbarHelperEl.textContent = "검색 결과를 클릭하면 해당 주차로 이동하고 메시지를 강조합니다.";

    results.forEach(result => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "search-item";

      btn.innerHTML = `
        <div class="search-item-top">
          <span class="search-author" style="color:${escapeHtml(result.author_color)}">${escapeHtml(result.author)}</span>
          <span class="search-time">${escapeHtml(result.date_label)} · ${escapeHtml(result.time)}</span>
        </div>
        <div class="search-preview">${escapeHtml(makePreview(result.content))}</div>
      `;

      btn.addEventListener("click", () => {
        jumpToMessage(result);
      });

      searchResultsListEl.appendChild(btn);
    });
  }

  nicknameSearchEl.addEventListener("input", runNicknameSearch);

  clearSearchBtn.addEventListener("click", () => {
    nicknameSearchEl.value = "";
    activeMessageId = null;
    runNicknameSearch();
  });

  renderBrowser();
})();