#!/usr/bin/env node

const { splitStatements } = require('./execute-sql-file.cjs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const statements = splitStatements(`
CREATE TABLE example (id INT);
DELIMITER $$
CREATE PROCEDURE example_proc()
BEGIN
  SELECT 1;
END $$
DELIMITER ;
CALL example_proc();
`);

assert(statements.length === 3, 'SQL runner must preserve a DELIMITER procedure as one statement');
assert(statements[1].includes('SELECT 1;'), 'procedure body must retain its internal semicolon');
console.log('SQL runner verification passed.');
