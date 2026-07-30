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
    <script src="ddocraft.js" defer></script>
</head>
<body>
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

<!-- Modal: open a build saved on the server (temporary test harness). Hidden while not in use. -->
<div id="openBuild" class="modal">
    <div id="divOpenBuildDialog" class="modal-content">
        <div id="btnCloseOpenBuild" class="modalClose" onClick="dialogOpenBuild.style.display='none'">&times;</div>
        <h3 class="modalText modalHeading">Open Build</h3>
        <div id="openBuildEmpty" class="openBuildEmpty indent helpText" style="display:none;">No server saves found for this test user.</div>
        <div class="openBuildListWrap">
            <table class="openBuildTable">
                <thead>
                    <tr>
                        <th class="openBuildColOpen"></th>
                        <th class="sortable" onclick="handleSortOpenBuildList('charName')">Name</th>
                        <th class="sortable" onclick="handleSortOpenBuildList('charLevel')">Level</th>
                        <th class="sortable" onclick="handleSortOpenBuildList('effectCount')">Effects</th>
                        <th class="sortable" onclick="handleSortOpenBuildList('updateDate')">Updated</th>
                    </tr>
                </thead>
                <tbody id="openBuildTableBody"></tbody>
            </table>
        </div>
    </div>
</div>

<!-- Modal: version history for one build (temporary test harness). Hidden while not in use. -->
<div id="buildHistory" class="modal">
    <div id="divBuildHistoryDialog" class="modal-content">
        <div id="btnCloseBuildHistory" class="modalClose" onClick="dialogBuildHistory.style.display='none'">&times;</div>
        <h3 id="buildHistoryHeading" class="modalText modalHeading">Build History</h3>
        <div class="openBuildListWrap">
            <table class="openBuildTable">
                <thead>
                    <tr>
                        <th class="openBuildColOpen"></th>
                        <th>Level</th>
                        <th>Effects</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody id="buildHistoryTableBody"></tbody>
            </table>
        </div>
    </div>
</div>

<!--<h3>ISSUE: Prior save files may lose their Character Level setting. Please reset that and re-save.<br /> </h3>-->
<!--<h3><br /></h3>-->
<h1 style="float:left">DDO Cannith Crafting Planner b0.98</h1>
<h1 style="float:right"><img src="image/blank.png" alt="" class="iconButtonSpacer"/><img src="image/blank.png"
                                                                                         alt=""
                                                                                         class="iconButtonSpacer"/>
    <img src="image/blank.png" alt="" class="iconButtonSpacer"/>
    <img id="iconSave" src="image/save.svg" alt="Save" onClick="handleSaveToServer()" class="iconButtonImage"/>
    <img src="image/open.svg" alt="Open" onClick="handleLoadFromServer()" class="iconButtonImage"/>
    <img id="iconDownload" src="image/download.svg" alt="Download" onClick="handleDownloadReport()" class="iconButtonImage"/>
    <img src="image/blank.png" alt="" class="iconButtonSpacer"/>
    <img src="image/help.png" alt="Help" onClick="showHelp()" class="iconButtonImage"/>
    <img src="image/about.png" alt="About" onClick="showAbout()" class="iconButtonImage"/>
    <!--    <img src="image/blank.png" alt="" class="iconButtonSpacer"/>-->
    <!--    <img src="image/newGame.png" alt="New Game" onClick="resetGame()" class="iconButtonImage"/>-->
</h1>

<!-- Character info: a title/subtitle-style nameplate when collapsed (presentation mode), a
     compact edit form plus highlight filters when expanded (edit mode). One toggle for the whole
     section - see toggleCharacterInfoSection() in ddocraft.js. -->
<div id="characterInfo" class="characterInfo">
    <div id="characterInfoPresentation" class="characterInfoPresentation" onclick="toggleCharacterInfoSection()" style="display:none;">
        <span class="characterInfoTriangle">&#9655;</span>
        <span id="characterInfoTitle" class="characterInfoTitle"></span>
    </div>
    <div id="characterInfoEdit" class="characterInfoEdit">
        <div class="characterInfoHeader" onclick="toggleCharacterInfoSection()">&#9661; Character</div>
        <div class="characterInfoFields">
            <div class="characterInfoField">
                <label for="characterName">Name</label>
                <input type="text" id="characterName" onchange="handleRename()" placeholder="Character Name">
            </div>
            <div class="characterInfoField">
                <label for="characterLevel">Level</label>
                <input type="number" id="characterLevel" name="characterLevel" onchange="handleCharLevelChange()"
                       min="1" max="36" placeholder="1-36" class="charLevelInput" required />
            </div>
            <div class="characterInfoField">
                <label for="characterClass">Class</label>
                <select id="characterClass" onchange="handleClassChange()">
                    <option value="">(none)</option>
                </select>
            </div>
        </div>
        <div class="characterInfoHighlightLabel">Highlight</div>
        <div class="helpText">
            <p>Check enchantment groups to highlight effects that benefit them. This doesn't select or deselect
                anything in your build - it just helps with clutter and highlights enchantments commonly
                prioritized for the groups checked.</p>
        </div>
        <div class="helpText modal-checklist">
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
        </div>

        <p style="clear: both"></p>
    </div>
</div>

<div id="enchantmentOptions"></div>
<div id="result" class="result"></div>
<div id="loadSave" class="loadSave">
    <button id="save" onclick="handleSave()" class="loadSaveBtn"> Save...</button>
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    <button onclick="document.getElementById('loadFile').click()" class="loadSaveBtn"> Open...</button>
    <input type='file' id="loadFile" style="display:none">
</div>
<div id="loadSaveServer" class="loadSave">
    <em>Server save/open - temporary test harness, not the real per-user feature yet:</em><br />
    <label for="testUserId">Test User ID:</label>
    <input type="number" id="testUserId" value="1" min="1" style="width:4em;">&nbsp;
    <button onclick="handleSaveToServer()" class="loadSaveBtn"> Save to Server...</button>
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    <button onclick="handleLoadFromServer()" class="loadSaveBtn"> Open from Server...</button>
</div>


<?php
displayCounter();
?>
</body>
</html>
