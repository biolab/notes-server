cd db
if [ ! -d backups ]; then
  mkdir backups
fi

STEM=backups/$(date +%Y%m%d_%H%M%S)

sqlite3 notes.sqlite <<EOF
.headers on
.mode csv

.output $STEM-answers.csv
SELECT
    u.email           AS userEmail,
    b.path            AS bookPath,
    g.name            AS groupName,
    q.questionId      AS questionId,
    a.answer,
    a.createdAt,
    a.isCorrect,
    a.points
FROM answers a
         JOIN users     u ON a.userId     = u.id
         JOIN books     b ON a.bookId     = b.id
         LEFT JOIN groups    g ON a.groupId    = g.id
         JOIN questions q ON a.questionId = q.id;

.output $STEM-users.csv
SELECT
    accessToken, name, surname, email, admin, createdAt, lastUseAt FROM users;
EOF

cd - > /dev/null
