AI link summarizer: 
** Issue cant fetch all the content of the page- possible but it will affect the prompt length.

const fetchPageText = async (url) => {
  const response = await axios.get(url, {
    headers: {
      // Some sites require a browser-like UA to return full HTML
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    timeout: 15000,
  });

  const text = htmlToText(response.data || "");
  // keep prompt small enough for model while preserving context
  return text.slice(0, 8000);
};

Gmail Syncing:
- Limitation : Date Range Filtering - user can only select the date to start the filter and the days (like 7 days ago of the selected date)