with open('src/components/DashboardPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = "const pathname = window.location.pathname.toLowerCase();"
injection = '''
    const params = new URLSearchParams(window.location.search);
    const tabParam = (params.get('tab') || params.get('view') || '').toLowerCase();
'''

if 'const params = new URLSearchParams' not in text:
    text = text.replace(target, target + injection)

with open('src/components/DashboardPage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Injected params definition")
