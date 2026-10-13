import re
with open('src/components/DashboardPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.finditer(r'<div className="stats-grid">', text)
with open('matches12.txt', 'w', encoding='utf-8') as f:
    for m in matches:
        f.write(text[m.start()-200:m.end()+1200] + '\n\n---\n\n')
