import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();

// HTML template for log viewer
const logViewerHTML = (logs: string, logFile: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Log Viewer - ${logFile}</title>
    <style>
        body {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            margin: 0;
            padding: 20px;
            background-color: #1e1e1e;
            color: #d4d4d4;
        }
        .header {
            background: #2d2d30;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #007acc;
        }
        .header h1 {
            margin: 0;
            color: #569cd6;
        }
        .controls {
            margin-bottom: 20px;
        }
        .btn {
            background: #0e639c;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            margin-right: 10px;
        }
        .btn:hover {
            background: #1177bb;
        }
        .log-container {
            background: #1e1e1e;
            border: 1px solid #3e3e42;
            border-radius: 5px;
            padding: 15px;
            max-height: 80vh;
            overflow-y: auto;
            white-space: pre-wrap;
            font-size: 12px;
            line-height: 1.4;
        }
        .log-line {
            margin-bottom: 2px;
            padding: 2px 0;
        }
        .log-level-info { color: #4fc1ff; }
        .log-level-warn { color: #ffcc02; }
        .log-level-error { color: #f14c4c; }
        .log-level-debug { color: #b5cea8; }
        .timestamp { color: #9cdcfe; }
        .service { color: #dcdcaa; }
        .message { color: #ce9178; }
        .auto-refresh {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #252526;
            padding: 10px;
            border-radius: 5px;
            border: 1px solid #3e3e42;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 Log Viewer: ${logFile}</h1>
        <p>Real-time log monitoring for your Short URL service</p>
    </div>
    
    <div class="controls">
        <button class="btn" onclick="refreshLogs()">🔄 Refresh</button>
        <button class="btn" onclick="downloadLogs()">⬇️ Download</button>
        <button class="btn" onclick="clearView()">🗑️ Clear View</button>
    </div>

    <div class="auto-refresh">
        <label>
            <input type="checkbox" id="autoRefresh" onchange="toggleAutoRefresh()">
            Auto-refresh (10s)
        </label>
    </div>
    
    <div class="log-container" id="logContainer">${formatLogs(logs)}</div>

    <script>
        let autoRefreshInterval;
        
        function formatLogs(logs) {
            return logs.split('\\n').map(line => {
                if (!line.trim()) return '';
                
                try {
                    const logObj = JSON.parse(line);
                    const level = logObj.level || 'info';
                    const time = new Date(logObj.time).toLocaleString();
                    const service = logObj.service || 'unknown';
                    const msg = logObj.msg || logObj.message || line;
                    
                    return \`<div class="log-line">
                        <span class="timestamp">\${time}</span> 
                        <span class="log-level-\${level}">[\${level.toUpperCase()}]</span> 
                        <span class="service">[\${service}]</span> 
                        <span class="message">\${msg}</span>
                    </div>\`;
                } catch {
                    return \`<div class="log-line">\${line}</div>\`;
                }
            }).join('');
        }
        
        function refreshLogs() {
            window.location.reload();
        }
        
        function downloadLogs() {
            const element = document.createElement('a');
            const file = new Blob([document.getElementById('logContainer').innerText], {type: 'text/plain'});
            element.href = URL.createObjectURL(file);
            element.download = '${logFile}-' + new Date().toISOString().split('T')[0] + '.log';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        }
        
        function clearView() {
            document.getElementById('logContainer').innerHTML = '';
        }
        
        function toggleAutoRefresh() {
            const checkbox = document.getElementById('autoRefresh');
            if (checkbox.checked) {
                autoRefreshInterval = setInterval(refreshLogs, 10000);
            } else {
                clearInterval(autoRefreshInterval);
            }
        }
        
        // Format existing logs
        document.getElementById('logContainer').innerHTML = formatLogs(\`${logs.replace(/`/g, '\\`')}\`);
        
        // Auto-scroll to bottom
        const container = document.getElementById('logContainer');
        container.scrollTop = container.scrollHeight;
    </script>
</body>
</html>
`;

function formatLogs(logs: string): string {
  return logs.split('\n').map(line => {
    if (!line.trim()) return '';
    
    try {
      const logObj = JSON.parse(line);
      const level = logObj.level || 'info';
      const time = new Date(logObj.time).toLocaleString();
      const service = logObj.service || 'unknown';
      const msg = logObj.msg || logObj.message || line;
      
      return `<div class="log-line">
        <span class="timestamp">${time}</span> 
        <span class="log-level-${level}">[${level.toUpperCase()}]</span> 
        <span class="service">[${service}]</span> 
        <span class="message">${msg}</span>
      </div>`;
    } catch {
      return `<div class="log-line">${line}</div>`;
    }
  }).join('');
}

// Get available log files
router.get('/', (req, res) => {
  try {
    const logsDir = '/app/logs';
    if (!fs.existsSync(logsDir)) {
      return res.json({ message: 'No logs directory found', files: [] });
    }
    
    const files = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.log'))
      .map(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          path: `/logs/view/${file}`
        };
      });
    
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read logs directory' });
  }
});

// View specific log file
router.get('/view/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const logPath = path.join('/app/logs', filename);
    
    if (!fs.existsSync(logPath)) {
      return res.status(404).send('Log file not found');
    }
    
    // Get the last 1000 lines to avoid overwhelming the browser
    const logContent = fs.readFileSync(logPath, 'utf8');
    const lines = logContent.split('\n');
    const lastLines = lines.slice(-1000).join('\n');
    
    res.send(logViewerHTML(lastLines, filename));
  } catch (error) {
    res.status(500).send('Error reading log file');
  }
});

// Download log file
router.get('/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const logPath = path.join('/app/logs', filename);
    
    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ error: 'Log file not found' });
    }
    
    res.download(logPath, filename);
  } catch (error) {
    res.status(500).json({ error: 'Error downloading log file' });
  }
});

export default router;