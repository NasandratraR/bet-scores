-- Migration vers la version multi-ligues
-- À exécuter UNE FOIS sur une base bet_scores existante

CREATE TABLE IF NOT EXISTS leagues (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    league_id INT NOT NULL,
    name      VARCHAR(100) NOT NULL,
    level     ENUM('fort','moyen','faible') NULL,
    UNIQUE KEY uq_league_team (league_id, name),
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE
);

ALTER TABLE leagues ADD COLUMN ref_team    VARCHAR(100) NULL AFTER name;
ALTER TABLE leagues ADD COLUMN nb_journees INT NOT NULL DEFAULT 38 AFTER ref_team;
ALTER TABLE matches ADD COLUMN league_id INT NULL AFTER id;
ALTER TABLE matches ADD CONSTRAINT fk_matches_league
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE SET NULL;

INSERT IGNORE INTO leagues (id, name, ref_team) VALUES (1, 'English League', 'London Reds');
INSERT IGNORE INTO teams (league_id, name, level) VALUES
  (1, 'Manchester Blue', 'fort'),   (1, 'Liverpool',     'fort'),
  (1, 'Brighton',        'fort'),   (1, 'London Reds',   'fort'),
  (1, 'A. Villa',        'fort'),   (1, 'Manchester Red','fort'),
  (1, 'C Palace',        'fort'),
  (1, 'Fulham',          'moyen'),  (1, 'Bournemouth',   'moyen'),
  (1, 'Newcastle',       'moyen'),  (1, 'West Ham',      'moyen'),
  (1, 'Brentford',       'moyen'),  (1, 'Wolverhampton', 'moyen'),
  (1, 'N Forest',        'moyen'),
  (1, 'London Blues',    'faible'), (1, 'Spurs',         'faible'),
  (1, 'Burnley',         'faible'), (1, 'Everton',       'faible'),
  (1, 'Sunderlands',     'faible'), (1, 'Leeds',         'faible');

-- Rattacher les matchs existants à English League
UPDATE matches SET league_id = 1 WHERE league_id IS NULL;
