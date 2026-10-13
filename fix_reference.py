with open('src/components/DashboardPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# We need to move `const params = ... \n const tabParam = ...` up BEFORE it is used.
# Let's just find the `const pathname = window.location.pathname.toLowerCase();`
# And add `params` and `tabParam` right below it.

target = "const pathname = window.location.pathname.toLowerCase();"
injection = '''
    const params = new URLSearchParams(window.location.search);
    const hasOldTabParam = params.has('tab') || params.has('view');
    const tabParam = (params.get('tab') || params.get('view') || '').toLowerCase();
    const oldTabVal = tabParam;
'''

text = text.replace(target, target + injection)

# Remove the old definitions
text = re.sub(r"const params = new URLSearchParams\(window\.location\.search\);\s*const hasOldTabParam = params\.has\('tab'\) \|\| params\.has\('view'\);\s*const oldTabVal = \(params\.get\('tab'\) \|\| params\.get\('view'\) \|\| ''\)\.toLowerCase\(\);\s*", "", text)
text = re.sub(r"const tabParam = \(params\.get\('tab'\) \|\| params\.get\('view'\) \|\| ''\)\.toLowerCase\(\);\s*", "", text)

with open('src/components/DashboardPage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Fixed tabParam reference error")
