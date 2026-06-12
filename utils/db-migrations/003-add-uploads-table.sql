CREATE TABLE IF NOT EXISTS uploads
(
    answerId  INTEGER NOT NULL REFERENCES answers (id) ON DELETE CASCADE,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    filename  TEXT NOT NULL,
    size      INTEGER NOT NULL,
    UNIQUE (answerId, filename)
);

CREATE INDEX IF NOT EXISTS idx_uploads_answerId ON uploads(answerId);
