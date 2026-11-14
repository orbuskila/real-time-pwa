<?php
/**
 * Plugin Name: OrWebCraft BirdNET Live Photo Repair
 * Description: Hosts BirdNET Live with repaired Explore photos and loading messages. Shortcode: [orwebcraft_birdnet_fixed]
 * Version: 1.2.0
 * License: MIT
 */
if (!defined('ABSPATH')) { exit; }
add_shortcode('orwebcraft_birdnet_fixed', function () {
    $url = plugins_url('app/index.html?v=1.2.0', __FILE__);
    return '<section aria-label="BirdNET Live bird sound analyzer"><p><a href="' . esc_url($url) . '" target="_blank" rel="noopener">Open BirdNET Live full screen ↗</a></p><iframe title="BirdNET Live bird sound identification" src="' . esc_url($url) . '" allow="microphone; geolocation" style="width:100%;height:850px;border:0" loading="eager"></iframe><p>BirdNET processes audio on your device. Species photos come from iNaturalist and retain contributor and license credits. Microphone and location access are optional.</p></section>';
});

