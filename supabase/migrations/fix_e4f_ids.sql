-- E4F Mining Fix
UPDATE public.ad_gate_config SET mining_03_onclicka='6153774E4F', box_03_onclicka='6153772E4F', spin_03_onclicka='6153717E4F';
UPDATE public.app_settings SET mining_03_onclicka='6153774E4F', box_03_onclicka='6153772E4F', spin_03_onclicka='6153717E4F';
UPDATE public.admin_config SET mining_03_onclicka='6153774E4F', box_03_onclicka='6153772E4F', spin_03_onclicka='6153717E4F';
UPDATE public.app_config SET value='6153774E4F' WHERE key='mining_03_onclicka';
UPDATE public.app_config SET value='6153772E4F' WHERE key='box_03_onclicka';
UPDATE public.app_config SET value='6153717E4F' WHERE key='spin_03_onclicka';
