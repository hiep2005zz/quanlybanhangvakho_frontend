import re

def fix_api():
    with open('src/services/api.ts', 'r', encoding='utf-8') as f:
        text = f.read()
    
    pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>>.*?\n', re.DOTALL)
    def repl(m):
        return m.group(1) + '\n' + m.group(2)
    
    new_text = pattern.sub(repl, text)
    with open('src/services/api.ts', 'w', encoding='utf-8') as f:
        f.write(new_text)

def fix_dashboard():
    with open('src/components/DashboardPage.tsx', 'r', encoding='utf-8') as f:
        text = f.read()
    
    pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>>.*?\n', re.DOTALL)
    def repl(m):
        return m.group(1) + '\n' + m.group(2)
    
    new_text = pattern.sub(repl, text)
    with open('src/components/DashboardPage.tsx', 'w', encoding='utf-8') as f:
        f.write(new_text)

fix_api()
fix_dashboard()
