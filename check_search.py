import re
with open('src/components/DashboardPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's find: `<input type="text" placeholder="Tìm kiếm theo mã`
import re
match = re.search(r'<input[^>]*?placeholder="Tìm kiếm theo mã', text)
if match:
    start_idx = max(0, match.start() - 500)
    print(text[start_idx:match.end()+100].encode('ascii', 'ignore').decode())
