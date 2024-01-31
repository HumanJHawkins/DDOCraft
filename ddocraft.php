<?php
session_start();

function logIP()
{
    // Adapted from IP logging function by Dave Lauderdale, originally published at: www.digi-dl.com
    $ipLog = "ddocraft_log.txt";
    $register_globals = (bool)ini_get('register_gobals');
    if ($register_globals) $ip = getenv(REMOTE_ADDR);
    else $ip = $_SERVER['REMOTE_ADDR'];

    $date = date("YmdAhis");
    $log = fopen("$ipLog", "a+");

    fputs($log, "$date: Visitor #" . getVisitorCount() . " $ip\r\n");
    fclose($log);
}

function updateCounter()
{
    if (empty($_SESSION['visited'])) {
        $counterFile = "ddocraft_counter.txt";
        $file = fopen("$counterFile", "r");
        $count = fgets($file, 1000);
        fclose($file);

        $count = abs(intval($count)) + 1;

        $file = fopen($counterFile, 'w');
        fwrite($file, $count);
        fclose($file);
    }

    $_SESSION['visited'] = true;
}

function getVisitorCount()
{
    $counterFile = "ddocraft_counter.txt";
    $file = fopen($counterFile, 'r');
    $count = fgets($file, 1000);
    fclose($file);

    return abs(intval($count));
}

function displayCounter()
{
    echo "<div id='counter'><p> Visitor Count: " . getVisitorCount() . " </p></div>";
}

logIp();
updateCounter();
?>


<!DOCTYPE html>
<!--Author: J. Hawkins-->
<!--Copyright 2021. GNU General Public License v3.0-->
<!--Permissions of this strong copyleft license are conditioned on making available complete source code of -->
<!--licensed works and modifications, which include larger works using a licensed work, under the same license. -->
<!--Copyright and license notices must be preserved. Contributors provide an express grant of patent rights.-->
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>DDOCraft: Cannith Crafting Planner b0.8</title>
    <link rel="stylesheet" href="ddocraft.css">
    <script src="dev_ddocraft.js" defer></script>
</head>
<body>
<!-- Modal preferences dialog. Hidden while not in use. -->
<div id="preferences" class="modal">
    <div id="divPreferenceDialog" class="modal-content">
        <div id="btnClosePreferences" class="modalClose" onClick="dialogPreferences.style.display='none'">&times;</div>
        <h3 class="modalText modalHeading">Settings</h3>
        <div class="helpText">
            <p>Check enchantment groups to show them. Uncheck to hide them. This does not select or deselect
                enchantments for your build, but it helps with clutter onscreen and highlights enchantments commonly
                prioritized for the groups checked.</p>
            <!--            <p>Name and level are used in the save file name. Level is only partly implemented in the filter, hiding-->
            <!--                the extra slot and insightful enchantments below level 10. As more data is added related to min levels,-->
            <!--                this may improve.  </p>-->
        </div>
        <!--        <p class="indent">-->
        <div class="helpText">
            <label for="characterLevel">Character Level:</label>
            <input type="number" id="characterLevel" name="characterLevel" value="32"
                   onchange="handleFilterLevel()" min="0" max="50" />&nbsp;&nbsp;&nbsp;<strong>&#8592;</strong>&nbsp;&nbsp;&nbsp;Set this at least!!!
        </div>


        <div class="helpText modal-checklist">
            <!--            <label for='prefsCharName'>Name: </label>-->
            <!--            <input type="text" id="prefsCharName" placeholder="Character Name" class="charName" />&nbsp;<br />-->
            <!--            <label for='prefsCharLevel'></label>-->
            <!--            <input type="number" id="prefsCharLevel" placeholder="20" class="charLevel" min="1" max="30" />&nbsp;&nbsp;<br />-->

            <table class="modal-table">
                <tr>
                    <td><label class='checklabel' for='allEnch'>
                            <input type='checkbox' id='allEnch' name='allEnch' value='allEnch'
                                   onchange="handleFilterCheckbox(this)" checked />All</label></td>
                </tr>
                <tr>
                <tr>
                    <td><label class='checklabel' for='basic'>
                            <input type='checkbox' id='basic' name='basic' value='basic'
                                   onchange="handleFilterCheckbox(this)"/>Basics</label>
                    </td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='nonscaling'>
                            <input type='checkbox' id='nonscaling' name='nonscaling' value='nonscaling'
                                   onchange="handleFilterCheckbox(this)"/>Non-scaling</label>
                    </td>
                </tr>
            </table>
            <table class="modal-table">
                <tr>
                    <td><label class='checklabel' for='forMeleeDmg'>
                            <input type='checkbox' id='forMeleeDmg' name='forMeleeDmg' value='forMeleeDmg'
                                   onchange="handleFilterCheckbox(this)"/>Melee Damage</label>
                    </td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forRangedDmg'>
                            <input type='checkbox' id='forRangedDmg' name='forRangedDmg' value='forRangedDmg'
                                   onchange="handleFilterCheckbox(this)"/>Ranged Damage</label>
                    </td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forACDefence'>
                            <input type='checkbox' id='forACDefence' name='forACDefence' value='forACDefence'
                                   onchange="handleFilterCheckbox(this)"/>AC Build</label>
                    </td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forResistDefence'>
                            <input type='checkbox' id='forResistDefence' name='forResistDefence'
                                   value='forResistDefence'
                                   onchange="handleFilterCheckbox(this)"/>Resistance</label>
                    </td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forHitPoints'>
                            <input type='checkbox' id='forHitPoints' name='forHitPoints' value='forHitPoints'
                                   onchange="handleFilterCheckbox(this)"/>Hit Points</label>
                    </td>
                </tr>
            </table>
            <table class="modal-table">
                <tr>
                    <td><label class='checklabel' for='forBarbarian'>
                            <input disabled type='checkbox' id='forBarbarian' name='forBarbarian' value='forBarbarian'
                                   onchange="handleFilterCheckbox(this)"/>Barbarian</label>
                    </td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forFighter'>
                            <input disabled type='checkbox' id='forFighter' name='forFighter' value='forFighter'
                                   onchange="handleFilterCheckbox(this)"/>Fighter</label>
                    </td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forPaladin'>
                            <input type='checkbox' id='forPaladin' name='forPaladin' value='forPaladin'
                                   onchange="handleFilterCheckbox(this)"/>Paladin</label>
                    </td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forRanger'>
                            <input disabled type='checkbox' id='forRanger' name='forRanger' value='forRanger'
                                   onchange="handleFilterCheckbox(this)"/>Ranger</label>
                    </td>
                </tr>

            </table>
            <table class="modal-table">
                <tr>
                    <td><label class='checklabel' for='forAlchemist'>
                            <input disabled type='checkbox' id='forAlchemist' name='forAlchemist' value='forAlchemist'
                                   onchange="handleFilterCheckbox(this)"/>Alchemist</label>
                    </td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forArtificer'>
                            <input type='checkbox' id='forArtificer' name='forArtificer' value='forArtificer'
                                   onchange="handleFilterCheckbox(this)"/>Artificer</label>
                    </td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forBard'>
                            <input disabled type='checkbox' id='forBard' name='forBard' value='forBard'
                                   onchange="handleFilterCheckbox(this)"/>Bard</label></td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forRogue'>
                            <input disabled type='checkbox' id='forRogue' name='forRogue' value='forRogue'
                                   onchange="handleFilterCheckbox(this)"/>Rogue</label></td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forMonk'>
                            <input disabled type='checkbox' id='forMonk' name='forMonk' value='forMonk'
                                   onchange="handleFilterCheckbox(this)"/>Monk</label></td>
                </tr>
            </table>
            <table class="modal-table">
                <tr>
                    <td><label class='checklabel' for='forCleric'>
                            <input type='checkbox' id='forCleric' name='forCleric' value='forCleric'
                                   onchange="handleFilterCheckbox(this)"/>Cleric</label>
                    </td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forDruid'>
                            <input disabled type='checkbox' id='forDruid' name='forDruid' value='forDruid'
                                   onchange="handleFilterCheckbox(this)"/>Druid</label></td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forFavoredSoul'>
                            <input disabled type='checkbox' id='forFavoredSoul' name='forFavoredSoul'
                                   value='forFavoredSoul'
                                   onchange="handleFilterCheckbox(this)"/>FavoredSoul</label>
                    </td>
                </tr>
            </table>

            <table class="modal-table">
                <tr>
                    <td><label class='checklabel' for='forSorcerer'>
                            <input type='checkbox' id='forSorcerer' name='forSorcerer' value='forSorcerer'
                                   onchange="handleFilterCheckbox(this)"/>Sorcerer</label>
                    </td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forWarlock'>
                            <input disabled type='checkbox' id='forWarlock' name='forWarlock' value='forWarlock'
                                   onchange="handleFilterCheckbox(this)"/>Warlock</label>
                    </td>
                </tr>
                <tr>
                    <td><label class='checklabel' for='forWizard'>
                            <input type='checkbox' id='forWizard' name='forWizard' value='forWizard'
                                   onchange="handleFilterCheckbox(this)"/>Wizard</label>
                    </td>
                </tr>
            </table>
        </div>

        <p style="clear: both"></p>
    </div>
</div>

<!-- Modal help dialog. Hidden while not in use. -->
<div id="help" class="modal">
    <div id="divHelpDialog" class="modal-content">
        <div id="btnCloseHelp" class="modalClose" onClick="dialogHelp.style.display='none'">&times;</div>
        <h3 class="modalText modalHeading">Help! </h3>
        <p class="indent helpText">
            Use the filter (under the gear icon) to select some or all of the categories of enchantments you are
            interested in. Consider and make a decision on the brightest highlights first. These are enchantments
            most people seem to agree are really useful, and some of them are not available except in a few locations.
            So it is important to get them if you care before adding other enchantments that might block them from
            being available.
        </p>
        <p class="indent helpText">Be aware that you can click to collapse or expand items, slots or augment colors. If
            you have an item with a particular color augment slot, you can collapse the other colors to get them out
            of the way.
        </p>
        <p class="indent helpText">Use the save / open buttons at the bottom to preserve your work. This is
            beta and the file structure may change. For a rock solid backup of your plan, copy the text out of the description.
            That way you can always reconstruct it.
        </p>
    </div>
</div>

<!-- Modal about dialog. Hidden while not in use. -->
<div id="about" class="modal">
    <div id="divAboutDialog" class="modal-content">
        <div id="btnCloseAbout" class="modalClose" onClick="dialogAbout.style.display='none'">&times;</div>
        <h3 class="modalText modalHeading">About DDO Cannith Crafting Planner</h3>
        <p class="indent helpText">
            This app (and especially the data behind it) is at a beta level of completion. It's fairly stable, but
            there will be bugs. Please double-check results in-game before actually using your valuable crafting
            materials. Your licence to use this software is governed by the
            <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">GPL 3.0 License</a> and in short, I
            am not liable for the loss of your ingredients (or any other thing) related to your use of this software.
        </p>
        <p class="indent helpText helpEnd">
            <strong>Interested in making this better?</strong> If you believe something is in error (present when it
            shouldn't be, or missing when it should be there) please let me know. If you are up for a more extensive
            task, this could be much improved by adding minimum level data or by writing short names for the
            enchantments. Please contact me if you would like to participate in this.
        </p>
        <p class="indent helpText helpEnd">
            Send bug reports or suggestions via Github at <a href="https://github.com/HumanJHawkins/DDOCraft/issues"
                                                             target="_blank">https://github.com/HumanJHawkins/DDOCraft/issues</a>, or PM HumanJHawkins at
            <a href="https://www.ddo.com/en/forums/forum.php"
               target="_blank">https://www.ddo.com/en/forums/forum.php</a>.
            On the off chance you want to buy me a coffee (hey... it happened once!), my Venmo is @humanjhawkins.
        </p>
        <p class="indent helpText">
            Full source code is available at
            <a href="https://github.com/HumanJHawkins/DDOCraft"
               target="_blank">https://github.com/HumanJHawkins/DDOCraft</a>
        </p>
        <p class="indent helpText helpEnd">
            &copy; 2021 Jeff Hawkins except as noted in the code. This software is under GPL 3.0 license.
        </p>
    </div>
</div>
<h3>ISSUE: Prior save files may lose their Character Level setting. Please reset that and re-save.<br /> </h3>
<h3><br /></h3>
<h1 style="float:left">DDO Cannith Crafting Planner b0.95</h1>
<h1 style="float:right"><img src="image/blank.png" alt="" class="iconButtonSpacer"/><img src="image/blank.png"
                                                                                         alt=""
                                                                                         class="iconButtonSpacer"/>
    <img src="image/blank.png" alt="" class="iconButtonSpacer"/>
    <img src="image/preferences.png" alt="Preferences" onClick="showPreferences()" class="iconButtonImage"/>
    <img src="image/help.png" alt="Help" onClick="showHelp()" class="iconButtonImage"/>
    <img src="image/about.png" alt="About" onClick="showAbout()" class="iconButtonImage"/>
    <!--    <img src="image/blank.png" alt="" class="iconButtonSpacer"/>-->
    <!--    <img src="image/newGame.png" alt="New Game" onClick="resetGame()" class="iconButtonImage"/>-->
</h1>

<div id="enchantmentOptions"></div>
<div id="result" class="result"></div>
<div id="loadSave" class="loadSave">
    <label for='characterName'></label>
    <input type="text" id="characterName" onchange="handleRename()" placeholder="Character Name" class="charName">&nbsp;
    <button id="save" onclick="handleSave()" class="loadSaveBtn"> Save...</button>
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    <button onclick="document.getElementById('loadFile').click()" class="loadSaveBtn"> Open...</button>
    <input type='file' id="loadFile" style="display:none">
</div>


<?php
displayCounter();
?>
</body>
</html>



