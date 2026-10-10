SET @@session.time_zone = '+08:00';

DELETE FROM `sys_menu`
WHERE `name` = 'DashboardAiStatsView'
  AND `auth_code` = 'AI:Stats:View';
