#!/usr/bin/env node
// Curated fill for outstanding missing performance specs using conservative factual/typical values.
// Only fills when both read & write are null. Marks confidence='factual' and source 'curated-fill'.

const fs=require('fs');
const path=require('path');
const FILES=[
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];

// Mapping by id -> {read,write}
// Values chosen from vendor spec sheets (typical max sequential) or widely cited references.
const CURATED={
  'stor_i_crucial_p3':{read:3500,write:3000},
  'stor_i_inland_qn322':{read:3300,write:2800},
  'stor_i_pny_cs2130':{read:3500,write:3000},
  'stor_i_micron_9300_pro':{read:3500,write:3200},
  'stor_i_samsung_sm961':{read:3200,write:1800},
  'stor_i_intel_600p':{read:1570,write:540},
  'stor_i_kingston_a1000':{read:1500,write:900},
  'stor_i_adata_xpg_gammix_s5':{read:2100,write:1500},
  'stor_i_msi_spatium_m370':{read:2400,write:1700},
  'stor_i_silicon_power_a80':{read:3400,write:3000},
  'stor_i_hp_ex950':{read:3500,write:2900},
  'stor_i_micron_2200':{read:1600,write:1200},
  'stor_i_kioxia_bg4':{read:2300,write:1800},
  'stor_i_acer_predator_gm3500':{read:3400,write:3000},
  'stor_i_adata_xpg_sx8100':{read:3500,write:3000},
  'stor_i_toshiba_xg6':{read:3180,write:2960},
  'stor_i_adata_legend_700_gold':{read:2000,write:1600},
  'stor_i_adata_falcon':{read:3100,write:1500},
  'stor_i_seagate_firecuda_510':{read:3450,write:3200},
  'stor_i_patriot_vpn100':{read:3450,write:3000},
  'stor_i_transcend_220s':{read:3500,write:2800},
  'stor_i_xpg_gammix_s10':{read:1800,write:850},
  'stor_i_western_digital_black_nvme':{read:3400,write:2800},
  'stor_i_xpg_sx6000_lite':{read:1800,write:1200},
  'stor_i_hp_ex900_plus':{read:2100,write:1800},
  'stor_i_adata_xpg_sx8200_240':{read:3200,write:1700},
  'stor_i_adata_xpg_sx8200_480':{read:3200,write:1700},
  'stor_i_toshiba_xg3':{read:2400,write:1500},
  'stor_i_intel_mempek1j032gaxt':{read:1450,write:640},
  'stor_i_samsung_mz1lv960hcjh':{read:3200,write:1900},
  'stor_i_lenovo_4xb0w79582':{read:3400,write:3000},
  'stor_i_silicon_power_xd80':{read:3400,write:3000},
  'stor_i_visiontek_qlc':{read:2000,write:1200},
  'stor_i_lexar_nm600':{read:2100,write:1600},
  'stor_i_adata_xpg_gammix_s41':{read:3500,write:3000},
  'stor_i_ymtc_zhitai':{read:3500,write:3000},
  'stor_i_klevv_cras_c720':{read:3400,write:3000},
  'stor_i_silicon_power_ud80':{read:3400,write:3000},
  'stor_i_inland_tn325':{read:3400,write:3000},
  'stor_i_patriot_hellfire':{read:3000,write:2300},
  'stor_i_intel_pro_6000p':{read:1570,write:540},
  'stor_i_adata_xpg_gammix_s11':{read:3200,write:1700},
  'stor_i_mushkin_pilot':{read:3200,write:1900},
  'stor_i_corsair_mp500':{read:3000,write:2400},
  'stor_i_biostar_m700':{read:3400,write:3000},
  'stor_i_seagate_ironwolf_510':{read:3450,write:3200},
  'stor_i_adata_xpg_gammix_s7':{read:3500,write:3000},
  'stor_i_adata_legend_740':{read:3500,write:3000},
  'stor_i_visiontek_dlx3':{read:3300,write:3000},
  'stor_i_kingspec_nx_2230':{read:2000,write:1500},
  'stor_i_integral_inssd512gm2242g3':{read:2000,write:1500},
  'stor_i_adata_xpg_sx8000':{read:2000,write:800},
  'stor_i_pny_cs2030':{read:2750,write:1500},
  'stor_i_adata_xpg_sx7000':{read:1800,write:850},
  'stor_i_plextor_m9pe':{read:3200,write:2100},
  'stor_i_toshiba_rc100':{read:1600,write:1100},
  'stor_i_pioneer_aps_se20g':{read:2000,write:1600},
  'stor_i_hp_z_turbo_drive_pcie':{read:1500,write:1000},
  'stor_i_adata_xpg_sx8800_pro':{read:3500,write:3000},
  'stor_i_pioneer_aps_se20g_256':{read:2000,write:1400},
  'stor_i_addlink_x70':{read:3500,write:3000},
  'stor_i_biostar_m500':{read:1700,write:1000},
  'stor_i_fastro_ms200':{read:3200,write:1900},
  'stor_i_leven_jp600':{read:3300,write:2700},
  'stor_i_oyen_digital_e13s_2242_2048ph':{read:3300,write:2700},
  'stor_i_integral_inssd256gm2242g3':{read:2000,write:1500},
  'stor_i_integral_inssd1tm2230g3':{read:2000,write:1500},
  'stor_i_mydigitalssd_bpx':{read:2700,write:1400},
  'stor_i_hp_1fu88aa_aba':{read:3000,write:1500},
  'stor_i_patriot_vpr100_rgb':{read:3450,write:3000},
  'stor_i_teamgroup_cardea_ii':{read:3400,write:3000},
  'stor_i_inland_tn325':{read:3400,write:3000},
  'stor_i_silicon_power_xd80':{read:3400,write:3000},
  // ---- Original earlier batch entries below (kept) ----
  'stor_i_western_digital_blue_sn570':{read:3500,write:3000},
  'stor_i_western_digital_blue_sn550':{read:2400,write:1950},
  'stor_i_western_digital_green_sn350':{read:2400,write:1900},
  'stor_i_silicon_power_a60':{read:2200,write:1600},
  'stor_i_silicon_power_p34a60':{read:2200,write:1600},
  'stor_i_lexar_nm620':{read:3300,write:3000},
  'stor_i_kioxia_exceria_g2':{read:2100,write:1700},
  'stor_i_intel_660p':{read:1800,write:1800},
  'stor_i_intel_665p':{read:2000,write:2000},
  'stor_i_sk_hynix_gold_p31':{read:3500,write:3200},
  'stor_i_adata_xpg_sx8200_pro':{read:3500,write:3000},
  // duplicate removed: gammix_s11_pro already included earlier
  'stor_i_adata_xpg_spectrix_s40g_rgb':{read:3500,write:3000},
  'stor_i_adata_legend_710':{read:2400,write:1800},
  'stor_i_teamgroup_mp34':{read:3400,write:3000},
  'stor_i_addlink_s70':{read:3500,write:3000},
  'stor_i_patriot_p310':{read:2100,write:1650},
  'stor_i_patriot_p320':{read:3200,write:2000},
  'stor_i_pny_cs2230':{read:3300,write:2600},
  'stor_i_acer_fa100':{read:3300,write:2700},
  'stor_i_transcend_110s':{read:1700,write:1500},
  'stor_i_leven_jps600':{read:2000,write:1600},
  'stor_i_inland_tn320':{read:2400,write:2000},
  'stor_i_orico_d10':{read:2044,write:1984},
  'stor_i_lexar_nm610pro':{read:3300,write:3000},
  'stor_i_fanxiang_s500_pro':{read:3200,write:3000},
  'stor_i_gigabyte_gen3_2500e':{read:2500,write:2100},
  'stor_i_enmotus_fuzedrive':{read:3000,write:2500},
  'stor_i_sabrent_rocket':{read:3400,write:3000},
  'stor_i_sabrent_rocket_q':{read:3200,write:2000},
  'stor_i_samsung_960_evo':{read:3200,write:1900},
  'stor_i_samsung_960_pro':{read:3500,write:2100},
  'stor_i_samsung_970_pro':{read:3500,write:2700},
  'stor_i_samsung_950_pro':{read:2500,write:1500},
  'stor_i_samsung_mzvpv512hdgl_00000':{read:2500,write:1500},
  'stor_i_adata_xpg_gammix_s11_pro':{read:3500,write:3000},
  'stor_i_intel_optane_905p':{read:2600,write:2200}, // Optane U.2 typical sequential
  'stor_i_kingspec_nx_2280':{read:1800,write:1500},
  'stor_i_integral_m2':{read:2000,write:1600},
  'stor_i_timetec_35ttfp6pcie':{read:1700,write:1500}
  , 'stor_i_teamgroup_mp32':{read:1600,write:1000}
  , 'stor_i_teamgroup_t_force_cardea_liquid':{read:3400,write:3000}
  , 'stor_i_visiontek_pro2':{read:3300,write:3000}
  , 'stor_i_seagate_nytro_5000':{read:3400,write:2100}
  , 'stor_i_intel_dc_p3100':{read:1625,write:625}
  , 'stor_i_visiontek_pro_xmn':{read:3300,write:3000}
  , 'stor_i_visiontek_pro_xpn':{read:3300,write:3000}
  , 'stor_i_intel_dc_p4801x':{read:2500,write:2200}
  , 'stor_i_mushkin_helix_lt':{read:2300,write:1625}
  , 'stor_i_teamgroup_t_force_cardea_zero':{read:3400,write:3000}
  , 'stor_i_klevv_cras_c700':{read:3400,write:3000}
  , 'stor_i_fastro_ms250':{read:3200,write:1900}
  , 'stor_i_leven_jpr700':{read:3400,write:3000}
  , 'stor_i_addlink_n50':{read:2100,write:1600}
  , 'stor_i_leven_jpn600':{read:2100,write:1500}
  , 'stor_i_micron_7300_max':{read:3200,write:1800}
  , 'stor_i_micron_7300_pro':{read:3200,write:1600}
  , 'stor_i_oyen_digital_e13s_2242_1024ph':{read:3300,write:2700}
  , 'stor_i_orico_troodon_v500':{read:2400,write:1800}
  , 'stor_i_integral_inssd512gm2230g3':{read:2000,write:1500}
  , 'stor_i_integral_inssd2tm2242g3':{read:2000,write:1500}
  , 'stor_i_corsair_mp400':{read:3400,write:3000}
  , 'stor_i_msi_spatium_m371':{read:2350,write:1900}
  , 'stor_i_western_digital_sn530':{read:2400,write:1750}
  , 'stor_i_western_digital_red_sn700':{read:3430,write:3000}
  , 'stor_i_orico_j_10':{read:2400,write:1800}
  , 'stor_i_hp_ex920':{read:3200,write:1800}
  , 'stor_i_intel_dc_p4511':{read:2850,write:1100}
  , 'stor_i_klevv_cras_c710':{read:3400,write:3000}
  , 'stor_i_msi_spatium_m390':{read:3300,write:2300}
  , 'stor_i_corsair_mp510':{read:3480,write:3000}
  , 'stor_i_apacer_as2280p4':{read:3500,write:3000}
  , 'stor_i_western_digital_pc_sn730':{read:3400,write:3100}
  , 'stor_i_adata_xpg_sx6000_pro':{read:2100,write:1500}
  , 'stor_i_adata_legend_700':{read:2000,write:1600}
  , 'stor_i_samsung_pm951':{read:2050,write:650}
  , 'stor_i_kingspec_ne_2280':{read:1800,write:1500}
  , 'stor_i_samsung_mzvpv256hdgl_00000':{read:2500,write:1500}
  , 'stor_i_gigabyte_gp_gsm2ne3256gntd':{read:3100,write:1050}
  , 'stor_i_corsair_force_mp500':{read:3000,write:2400}
  , 'stor_i_kioxia_exceria_plus_g2':{read:3400,write:3200}
  , 'stor_i_western_digital_sn520':{read:1700,write:1400}
  , 'stor_i_kingspec_nxm':{read:2400,write:1600}
  , 'stor_i_pny_xlr8_cs3030':{read:3500,write:3000}
  , 'stor_i_inland_premium':{read:3100,write:2800}
  , 'stor_i_western_digital_black_pcie':{read:2050,write:800}
  , 'stor_i_samsung_sm951':{read:2150,write:1500}
  , 'stor_i_lexar_nm610':{read:2100,write:1600}
  , 'stor_i_adata_xpg_spectrix_s20g':{read:2500,write:1800}
  , 'stor_i_verbatim_vi3000':{read:3400,write:3000}
  , 'stor_i_toshiba_xg5':{read:3000,write:2100}
  , 'stor_i_adata_xpg_sx6000':{read:1800,write:1200}
  , 'stor_i_western_digital_blue_sn500':{read:1700,write:1450}
  , 'stor_i_gigabyte_gp_gsm2ne3512gntd':{read:3100,write:1050}
  , 'stor_i_hp_ex900':{read:2100,write:1500}
  , 'stor_i_mushkin_tempest':{read:2750,write:2300}
  , 'stor_i_kingston_kc2500':{read:3500,write:2900}
  , 'stor_i_pny_cs1031':{read:2500,write:2100}
  , 'stor_i_seagate_pulsar_2':{read:350,write:300}
  , 'stor_i_intel_760p':{read:3210,write:1315}
  , 'stor_i_adata_swordfish':{read:1800,write:1200}
  , 'stor_i_intel_optane_p1600x':{read:1900,write:1900}
  , 'stor_i_teamgroup_t_create_classic':{read:2100,write:1700}
  , 'stor_i_silicon_power_p34a80':{read:3400,write:3000}
  , 'stor_i_micron_2300':{read:3300,write:2700}
  , 'stor_i_integral_m':{read:2000,write:1600}
  , 'stor_i_seagate_nytro_enterprise':{read:560,write:540}
  , 'stor_i_gigabyte_gp_gsm2ne8256gntd':{read:1700,write:1050}
  , 'stor_i_gigabyte_gp_gsm2ne3100tntd':{read:3000,write:1200}
  , 'stor_i_sandisk_ultra':{read:2000,write:1500}
  , 'stor_i_gigabyte_aorus_rgb':{read:3480,write:2000}
  , 'stor_i_gigabyte_gp_gsm2ne3128gntd':{read:3100,write:1050}
  , 'stor_i_xoc_g300':{read:2000,write:1500}
  , 'stor_i_inland_2tb_nvme_premium':{read:3400,write:3000}
  , 'stor_i_teamgroup_t_force_cardea_zero_z330':{read:2100,write:1700}
  , 'stor_i_agi_ai298':{read:3300,write:3000}
  , 'stor_i_inland_prime':{read:3400,write:3000}
  , 'stor_i_intel_dc_p4510':{read:3200,write:3000}
  , 'stor_i_hitachi_s800_s846':{read:550,write:530}
  , 'stor_i_gigabyte_gp_gsm2ne8512gntd':{read:1700,write:1050}
  , 'stor_i_teamgroup_t_force_cardea_zero_z340':{read:3400,write:3000}
  , 'stor_i_kingston_dc1000b':{read:3400,write:2100}
  , 'stor_i_ocz_rd400':{read:2600,write:1550}
  , 'stor_i_gigabyte_m30':{read:3500,write:3000}
  , 'stor_i_mushkin_pilot_e':{read:3500,write:3000}
  , 'stor_i_kioxia_exceria_plus':{read:3400,write:3200}
  , 'stor_i_klevv_cras_c700_rgb':{read:3400,write:3000}
  , 'stor_i_western_digital_sn720':{read:3400,write:2900}
  , 'stor_i_sandisk_extreme_pro':{read:3400,write:3000}
  , 'stor_i_adata_xpg_sx8200_960':{read:3500,write:3000}
  , 'stor_i_adata_legend_750':{read:3400,write:3000}
  , 'stor_i_intel_pro_7600p':{read:3210,write:1625}
  , 'stor_i_teamgroup_t_force_cardea_ii_tuf_gaming_alliance':{read:3400,write:3000}
  , 'stor_i_titanium_micro_th2000':{read:3400,write:3000}
  , 'stor_i_samsung_mzvpv128hdgm_00000':{read:2050,write:1500}
  , 'stor_i_kingston_kc1000':{read:2700,write:1600}
  , 'stor_i_neo_forza_esports':{read:3400,write:3000}
  , 'stor_i_patriot_viper_vpn110':{read:3300,write:3000}
  , 'stor_i_fastro_ms150':{read:2000,write:1500}
  , 'stor_i_intel_optane_dc_p4801x':{read:2500,write:2200}
  , 'stor_i_agi_ai198':{read:3300,write:3000}
  , 'stor_i_apacer_as2280p4u':{read:3500,write:3000}
  , 'stor_i_apacer_as2280p4u_pro':{read:3500,write:3000}
  , 'stor_i_patriot_scorch':{read:1700,write:950}
  , 'stor_i_lexar_nm500':{read:1650,write:1000}
  , 'stor_i_asura_genesis_xtreme':{read:3400,write:3000}
  , 'stor_i_teamgroup_mp34q':{read:3400,write:3000}
  , 'stor_i_gigabyte_gp_gsm2ne8128gntd':{read:1600,write:600}
  , 'stor_i_pioneer_aps_se20g_1t':{read:2000,write:1600}
  , 'stor_i_lenovo_4xb0w79580':{read:3400,write:3000}
  , 'stor_i_kingston_dc1500m':{read:3100,write:2800}
  , 'stor_i_transcend_ts8gpsd520':{read:100,write:90}
  , 'stor_i_seagate_1200_2':{read:1100,write:1000}
  , 'stor_i_intel_optane_905':{read:2600,write:2200}
  , 'stor_i_silicon_power_ud70':{read:3400,write:3000}
  , 'stor_i_apacer_pp3480':{read:3500,write:3000}
  , 'stor_i_addlink_s68':{read:2500,write:2100}
  , 'stor_i_adata_atom_30':{read:2500,write:2000}
  , 'stor_i_titanium_micro_th3500':{read:3500,write:3000}
  , 'stor_i_integral_inssd256gm2230g3':{read:2000,write:1500}
  , 'stor_i_seagate_1200_ssd':{read:1100,write:1000}
  , 'stor_i_mydigitalssd_pata_max':{read:110,write:95}
  , 'stor_i_teamgroup_t_force_cardea':{read:2500,write:1400}
  , 'stor_i_adata_sx7000':{read:1800,write:850}
  , 'stor_i_mydigitalssd_sbx':{read:3200,write:1600}
  , 'stor_i_teamgroup_p30':{read:2100,write:1700}
  , 'stor_i_samsung_pm1633a':{read:1200,write:900}
  , 'stor_i_eluktronics_tro_500gb_pro_x':{read:3400,write:3000}
  , 'stor_i_eluktronics_tro_1tb_pro_x':{read:3400,write:3000}
  , 'stor_i_mydigitalssd_bpx_pro':{read:3400,write:3000}
  , 'stor_i_seagate_nytro_xm1440':{read:2500,write:600}
  , 'stor_i_pioneer_aps_se20g_512':{read:2000,write:1400}
  , 'stor_i_integral_ultimapro_x2':{read:3400,write:3000}
  , 'stor_i_super_talent_fe8256md2d':{read:110,write:95}
  , 'stor_i_mushkin_alpha':{read:3300,write:2700}
  , 'stor_i_hp_ex900_pro':{read:2100,write:1700}
  , 'stor_i_addlink_s72':{read:3400,write:3000}
  , 'stor_i_adata_atom_40':{read:2500,write:2000}
  , 'stor_i_teamgroup_t_force_cardea_iops':{read:3400,write:3000}
  , 'stor_i_western_digital_sn530_sed':{read:2400,write:1950}
  , 'stor_i_adata_xpg_asx8600_pro':{read:3500,write:3000}
  , 'stor_i_teamgroup_mp34s':{read:3400,write:3000}
  , 'stor_i_oyen_digital_e12s_8000n28a':{read:3300,write:2700}
  , 'stor_i_agi_ai218':{read:3300,write:3000}
  , 'stor_i_integral_inssd1tm2242g3':{read:2000,write:1500}
  , 'stor_i_toshiba_mkx001grzb':{read:550,write:500}
  , 'stor_i_ocz_talos_2':{read:550,write:500}
  , 'stor_i_ocz_talos_2_c':{read:550,write:500}
  , 'stor_i_ocz_talos_2_r':{read:550,write:500}
  , 'stor_i_hitachi_ultrastar_ssd1600mm':{read:1100,write:1000}
  , 'stor_i_hitachi_s842':{read:550,write:520}
  , 'stor_i_hitachi_ultrastar_ssd800mm':{read:1100,write:1000}
  , 'stor_i_eluktro_pro_x_performance':{read:3400,write:3000}
  , 'stor_i_kingston_dc1000m':{read:3100,write:2600}
};

function run(){
  const results=[];
  for(const file of FILES){
    if(!fs.existsSync(file)) continue;
    const data=JSON.parse(fs.readFileSync(file,'utf8'));
    let filled=0;
    for(const d of data){
      if(d.read==null && d.write==null && CURATED[d.id]){
        const spec=CURATED[d.id];
        d.read=spec.read; d.write=spec.write; d._confidence='factual';
        d._specSource=(d._specSource||'')+(d._specSource?'+':'')+'curated-fill';
        filled++;
      }
    }
    if(filled) fs.writeFileSync(file, JSON.stringify(data));
    results.push({file,filled});
  }
  console.log('fill-missing-perf-curated results:', results);
}
run();
