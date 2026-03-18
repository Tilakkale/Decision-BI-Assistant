import codecs
with codecs.open('backend/schema.sql', 'r', 'utf-8', 'replace') as f:
    t = f.read()
t = t.replace('lifetime_value NUMERIC(14,2) DEFAULT 0\r\n);', 'lifetime_value NUMERIC(14,2) DEFAULT 0,\n    ai_risk_score  INTEGER DEFAULT 0\n);')
t = t.replace('lifetime_value NUMERIC(14,2) DEFAULT 0\n);', 'lifetime_value NUMERIC(14,2) DEFAULT 0,\n    ai_risk_score  INTEGER DEFAULT 0\n);')
with codecs.open('backend/schema.sql', 'w', 'utf-8') as f:
    f.write(t)
