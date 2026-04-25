cd db

if [ -z "${1:-}" ]; then
  # pick latest timestamp from backups
  latest=$(ls -1 backups/*-users.csv 2>/dev/null | sort -r | head -n1)
  if [ -z "$latest" ]; then
    echo "No backups found!"
    exit 1
  fi
  timestamp=$(basename "$latest" | cut -d- -f1)
  echo "No timestamp provided, using latest: $timestamp"
else
  timestamp="$1"
fi


STEM=backups/$timestamp

sqlite3 notes.sqlite <<EOF
.mode csv

DROP TABLE IF EXISTS users_restore_staging;

CREATE TABLE users_restore_staging (
    accessToken TEXT,
    name        TEXT,
    surname     TEXT,
    email       TEXT,
    admin       TEXT,
    createdAt   TEXT,
    lastUseAt   TEXT
);
.import --skip 1 $STEM-users.csv users_restore_staging

INSERT INTO users (accessToken, name, surname, email, admin, createdAt, lastUseAt)
SELECT
    s.accessToken,
    s.name,
    s.surname,
    s.email,
    s.admin,
    s.createdAt,
    s.lastUseAt
FROM users_restore_staging s
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = s.email)
ON CONFLICT DO NOTHING;

DROP TABLE users_restore_staging;

CREATE TABLE answers_restore_staging (
                                         userEmail        TEXT,
                                         bookPath         TEXT,
                                         groupName        TEXT,
                                         questionId       TEXT,
                                         answer           TEXT,
                                         createdAt        TEXT,
                                         isCorrect        TEXT,
                                         points           TEXT
);
.import --skip 1 $STEM-answers.csv answers_restore_staging

INSERT INTO answers (userId, bookId, groupId, questionId, answer, createdAt, isCorrect, points)
SELECT
    u.id,
    b.id,
    g.id,
    q.id,
    s.answer,
    s.createdAt,
    s.isCorrect,
    s.points
FROM answers_restore_staging s
         JOIN users     u ON u.email     = s.userEmail
         JOIN books     b ON b.path      = s.bookPath
         LEFT JOIN groups g ON g.name    = s.groupName
         JOIN questions q ON q.questionId = s.questionId
WHERE NOT EXISTS (
    SELECT 1 FROM answers a
    WHERE a.userId = u.id
      AND a.bookId = b.id
      AND ( (a.groupId IS NULL AND s.groupName IS NULL)
        OR (a.groupId = g.id) )
      AND a.questionId = q.id
);

INSERT INTO uploads (answerId, filename, createdAt)
WITH RECURSIVE split_lines(id, createdAt, remaining, entry) AS (
    SELECT
        a.id,
        a.createdAt,
        up.filename || char(10) AS remaining, -- Ensure there's a trailing newline
        '' AS entry
    FROM answers_restore_staging s
    JOIN users     u ON u.email      = s.userEmail
    JOIN books     b ON b.path       = s.bookPath
    LEFT JOIN groups g ON g.name     = s.groupName
    JOIN questions q ON q.questionId = s.questionId
    JOIN answers   a ON a.userId = u.id
                    AND a.bookId = b.id
                    AND ((a.groupId IS NULL AND s.groupName IS NULL) OR (a.groupId = g.id))
                    AND a.questionId = q.id
    WHERE up.filename != ''

    UNION ALL

    SELECT
        id,
        createdAt,
        substr(remaining, instr(remaining, char(10)) + 1), -- Everything after the first newline
        substr(remaining, 1, instr(remaining, char(10)) - 1) -- Everything before the first newline
    FROM split_lines
    WHERE remaining != ''
)
SELECT id, entry, createdAt
FROM split_lines
WHERE entry != '';

DROP TABLE answers_restore_staging;
EOF

cd - > /dev/null
