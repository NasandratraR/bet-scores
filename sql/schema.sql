CREATE DATABASE IF NOT EXISTS bet_scores CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE bet_scores;

CREATE TABLE IF NOT EXISTS matches (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    saison     VARCHAR(20)  NULL,
    journee    INT          NULL,
    team_home  VARCHAR(100) NOT NULL,
    score_home INT          NOT NULL,
    score_away INT          NOT NULL,
    team_away  VARCHAR(100) NOT NULL,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
