sqlite3 ../db/notes.sqlite <<EOF
DELETE FROM users
WHERE email IS NULL AND
      (createdAt < datetime('now', '-90 days')
       OR (createdAt < datetime('now', '-7 day')
           AND NOT EXISTS (SELECT 1 FROM answers a WHERE a.userId = users.id))
      );
EOF
