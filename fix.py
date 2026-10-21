with open('src/components/DashboardPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('\\\'', '\'')
with open('src/components/DashboardPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
