-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: equipDDO
-- ------------------------------------------------------
-- Server version	8.0.19

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `enchantment`
--

DROP TABLE IF EXISTS `enchantment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `enchantment` (
  `enchantmentID` bigint NOT NULL AUTO_INCREMENT,
  `enchSortOrder` bigint DEFAULT '0',
  `enchGroup` varchar(64) NOT NULL DEFAULT 'Untitled',
  `enchName` varchar(64) NOT NULL DEFAULT 'Untitled',
  `enchShortName` varchar(32) DEFAULT 'Untitled',
  `enchBonusType` varchar(32) NOT NULL DEFAULT 'Untitled',
  `enchEffect` varchar(32) NOT NULL DEFAULT 'Untitled',
  `enchCannithMinLevel` int DEFAULT '0',
  `enchAugmentMinLevel` int DEFAULT '0',
  `enchDesc` varchar(256) DEFAULT NULL,
  `enchSupercededBy` varchar(64) DEFAULT NULL,
  `allEnch` tinyint DEFAULT '1',
  `basic` tinyint DEFAULT '1',
  `nonscaling` tinyint DEFAULT '1',
  `forMeleeDmg` tinyint DEFAULT '1',
  `forRangedDmg` tinyint DEFAULT '1',
  `forACDefence` tinyint DEFAULT '1',
  `forResistDefence` tinyint DEFAULT '1',
  `forHitPoints` tinyint DEFAULT '1',
  `forAlchemist` tinyint DEFAULT '1',
  `forArtificer` tinyint DEFAULT '1',
  `forBarbarian` tinyint DEFAULT '1',
  `forBard` tinyint DEFAULT '1',
  `forCleric` tinyint DEFAULT '1',
  `forDruid` tinyint DEFAULT '1',
  `forFavoredSoul` tinyint DEFAULT '1',
  `forFighter` tinyint DEFAULT '1',
  `forMonk` tinyint DEFAULT '1',
  `forPaladin` tinyint DEFAULT '1',
  `forRanger` tinyint DEFAULT '1',
  `forRogue` tinyint DEFAULT '1',
  `forSorcerer` tinyint DEFAULT '1',
  `forWarlock` tinyint DEFAULT '1',
  `forWizard` tinyint DEFAULT '1',
  `enchNotes` text,
  `createBy` bigint NOT NULL DEFAULT '0',
  `createTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updateBy` bigint NOT NULL DEFAULT '0',
  `updateTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`enchantmentID`),
  UNIQUE KEY `enchName` (`enchName`)
) ENGINE=InnoDB AUTO_INCREMENT=3931 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `itemOption`
--

DROP TABLE IF EXISTS `itemOption`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `itemOption` (
  `itemOptionID` bigint NOT NULL AUTO_INCREMENT,
  `itemOptionSortOrder` bigint DEFAULT '0',
  `itemOptionItem` varchar(64) NOT NULL DEFAULT 'Untitled',
  `itemOptionSlot` varchar(64) NOT NULL DEFAULT 'Untitled',
  `itemOptionEnchantment` varchar(64) NOT NULL DEFAULT 'Untitled',
  `createBy` bigint NOT NULL DEFAULT '0',
  `createTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updateBy` bigint NOT NULL DEFAULT '0',
  `updateTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`itemOptionID`),
  UNIQUE KEY `itemOptionItem` (`itemOptionItem`,`itemOptionSlot`,`itemOptionEnchantment`)
) ENGINE=InnoDB AUTO_INCREMENT=25921 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `vAllEnchantment`
--

DROP TABLE IF EXISTS `vAllEnchantment`;
/*!50001 DROP VIEW IF EXISTS `vAllEnchantment`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vAllEnchantment` AS SELECT 
 1 AS `itemOptionSortOrder`,
 1 AS `enchSortOrder`,
 1 AS `itemOptionItem`,
 1 AS `itemOptionSlot`,
 1 AS `augmentColor`,
 1 AS `itemOptionEnchantment`,
 1 AS `enchName`,
 1 AS `enchEffectType`,
 1 AS `enchCannithMinLevel`,
 1 AS `enchAugmentMinLevel`,
 1 AS `enchDesc`,
 1 AS `enchSupercededBy`,
 1 AS `allEnch`,
 1 AS `basic`,
 1 AS `nonscaling`,
 1 AS `forMeleeDmg`,
 1 AS `forRangedDmg`,
 1 AS `forACDefence`,
 1 AS `forResistDefence`,
 1 AS `forHitPoints`,
 1 AS `forAlchemist`,
 1 AS `forArtificer`,
 1 AS `forBarbarian`,
 1 AS `forBard`,
 1 AS `forCleric`,
 1 AS `forDruid`,
 1 AS `forFavoredSoul`,
 1 AS `forFighter`,
 1 AS `forMonk`,
 1 AS `forPaladin`,
 1 AS `forRanger`,
 1 AS `forRogue`,
 1 AS `forSorcerer`,
 1 AS `forWarlock`,
 1 AS `forWizard`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `vAugmentOption`
--

DROP TABLE IF EXISTS `vAugmentOption`;
/*!50001 DROP VIEW IF EXISTS `vAugmentOption`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vAugmentOption` AS SELECT 
 1 AS `itemOptionID`,
 1 AS `itemOptionSortOrder`,
 1 AS `itemOptionItem`,
 1 AS `itemOptionSlot`,
 1 AS `augmentColor`,
 1 AS `itemOptionEnchantment`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `vHomelessEnchantments`
--

DROP TABLE IF EXISTS `vHomelessEnchantments`;
/*!50001 DROP VIEW IF EXISTS `vHomelessEnchantments`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vHomelessEnchantments` AS SELECT 
 1 AS `enchName`,
 1 AS `itemOptionEnchantment`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `vItemOption`
--

DROP TABLE IF EXISTS `vItemOption`;
/*!50001 DROP VIEW IF EXISTS `vItemOption`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vItemOption` AS SELECT 
 1 AS `itemOptionID`,
 1 AS `itemOptionSortOrder`,
 1 AS `itemOptionItem`,
 1 AS `itemOptionSlot`,
 1 AS `augmentColor`,
 1 AS `itemOptionEnchantment`*/;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `vAllEnchantment`
--

/*!50001 DROP VIEW IF EXISTS `vAllEnchantment`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`humanjhawkins`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vAllEnchantment` AS select `combined`.`itemOptionSortOrder` AS `itemOptionSortOrder`,`enchantment`.`enchSortOrder` AS `enchSortOrder`,`combined`.`itemOptionItem` AS `itemOptionItem`,`combined`.`itemOptionSlot` AS `itemOptionSlot`,`combined`.`augmentColor` AS `augmentColor`,`combined`.`itemOptionEnchantment` AS `itemOptionEnchantment`,`enchantment`.`enchName` AS `enchName`,concat(`enchantment`.`enchBonusType`,'-',`enchantment`.`enchEffect`) AS `enchEffectType`,`enchantment`.`enchCannithMinLevel` AS `enchCannithMinLevel`,`enchantment`.`enchAugmentMinLevel` AS `enchAugmentMinLevel`,`enchantment`.`enchDesc` AS `enchDesc`,`enchantment`.`enchSupercededBy` AS `enchSupercededBy`,`enchantment`.`allEnch` AS `allEnch`,`enchantment`.`basic` AS `basic`,`enchantment`.`nonscaling` AS `nonscaling`,`enchantment`.`forMeleeDmg` AS `forMeleeDmg`,`enchantment`.`forRangedDmg` AS `forRangedDmg`,`enchantment`.`forACDefence` AS `forACDefence`,`enchantment`.`forResistDefence` AS `forResistDefence`,`enchantment`.`forHitPoints` AS `forHitPoints`,`enchantment`.`forAlchemist` AS `forAlchemist`,`enchantment`.`forArtificer` AS `forArtificer`,`enchantment`.`forBarbarian` AS `forBarbarian`,`enchantment`.`forBard` AS `forBard`,`enchantment`.`forCleric` AS `forCleric`,`enchantment`.`forDruid` AS `forDruid`,`enchantment`.`forFavoredSoul` AS `forFavoredSoul`,`enchantment`.`forFighter` AS `forFighter`,`enchantment`.`forMonk` AS `forMonk`,`enchantment`.`forPaladin` AS `forPaladin`,`enchantment`.`forRanger` AS `forRanger`,`enchantment`.`forRogue` AS `forRogue`,`enchantment`.`forSorcerer` AS `forSorcerer`,`enchantment`.`forWarlock` AS `forWarlock`,`enchantment`.`forWizard` AS `forWizard` from (`enchantment` left join (select `vItemOption`.`itemOptionID` AS `itemOptionID`,`vItemOption`.`itemOptionSortOrder` AS `itemOptionSortOrder`,`vItemOption`.`itemOptionItem` AS `itemOptionItem`,`vItemOption`.`itemOptionSlot` AS `itemOptionSlot`,`vItemOption`.`augmentColor` AS `augmentColor`,`vItemOption`.`itemOptionEnchantment` AS `itemOptionEnchantment` from `vItemOption` union select `vAugmentOption`.`itemOptionID` AS `itemOptionID`,`vAugmentOption`.`itemOptionSortOrder` AS `itemOptionSortOrder`,`vAugmentOption`.`itemOptionItem` AS `itemOptionItem`,`vAugmentOption`.`itemOptionSlot` AS `itemOptionSlot`,`vAugmentOption`.`augmentColor` AS `augmentColor`,`vAugmentOption`.`itemOptionEnchantment` AS `itemOptionEnchantment` from `vAugmentOption`) `combined` on((`combined`.`itemOptionEnchantment` = `enchantment`.`enchName`))) where (`combined`.`itemOptionSortOrder` is not null) order by `combined`.`itemOptionSortOrder`,`combined`.`itemOptionSlot`,`combined`.`augmentColor`,`enchantment`.`enchSortOrder` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vAugmentOption`
--

/*!50001 DROP VIEW IF EXISTS `vAugmentOption`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`humanjhawkins`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vAugmentOption` AS select `W2`.`itemOptionID` AS `itemOptionID`,`W1`.`itemOptionSortOrder` AS `itemOptionSortOrder`,`W1`.`itemOptionItem` AS `itemOptionItem`,`W1`.`itemOptionSlot` AS `itemOptionSlot`,`W2`.`augmentColor` AS `augmentColor`,`W2`.`itemOptionEnchantment` AS `itemOptionEnchantment` from ((select `itemOption`.`itemOptionSortOrder` AS `itemOptionSortOrder`,`itemOption`.`itemOptionItem` AS `itemOptionItem`,`itemOption`.`itemOptionSlot` AS `itemOptionSlot`,`itemOption`.`itemOptionEnchantment` AS `colorLink` from `itemOption` where (`itemOption`.`itemOptionSlot` like 'Augment%')) `W1` left join (select `itemOption`.`itemOptionID` AS `itemOptionID`,`itemOption`.`itemOptionSlot` AS `augmentColor`,`itemOption`.`itemOptionEnchantment` AS `itemOptionEnchantment` from `itemOption` where (`itemOption`.`itemOptionItem` = 'Augment')) `W2` on((`W1`.`colorLink` = `W2`.`augmentColor`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vHomelessEnchantments`
--

/*!50001 DROP VIEW IF EXISTS `vHomelessEnchantments`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`humanjhawkins`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vHomelessEnchantments` AS select `enchantment`.`enchName` AS `enchName`,`itemOption`.`itemOptionEnchantment` AS `itemOptionEnchantment` from (`enchantment` left join `itemOption` on((`enchantment`.`enchName` = `itemOption`.`itemOptionEnchantment`))) where (`itemOption`.`itemOptionEnchantment` is null) union select `enchantment`.`enchName` AS `enchName`,`itemOption`.`itemOptionEnchantment` AS `itemOptionEnchantment` from (`itemOption` left join `enchantment` on((`enchantment`.`enchName` = `itemOption`.`itemOptionEnchantment`))) where (`enchantment`.`enchName` is null) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vItemOption`
--

/*!50001 DROP VIEW IF EXISTS `vItemOption`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`humanjhawkins`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vItemOption` AS select `itemOption`.`itemOptionID` AS `itemOptionID`,`itemOption`.`itemOptionSortOrder` AS `itemOptionSortOrder`,`itemOption`.`itemOptionItem` AS `itemOptionItem`,`itemOption`.`itemOptionSlot` AS `itemOptionSlot`,'' AS `augmentColor`,`itemOption`.`itemOptionEnchantment` AS `itemOptionEnchantment` from `itemOption` where ((`itemOption`.`itemOptionItem` <> 'Augment') and (not((`itemOption`.`itemOptionSlot` like 'Augment%')))) union select `vAugmentOption`.`itemOptionID` AS `itemOptionID`,`vAugmentOption`.`itemOptionSortOrder` AS `itemOptionSortOrder`,`vAugmentOption`.`itemOptionItem` AS `itemOptionItem`,`vAugmentOption`.`itemOptionSlot` AS `itemOptionSlot`,`vAugmentOption`.`augmentColor` AS `augmentColor`,`vAugmentOption`.`itemOptionEnchantment` AS `itemOptionEnchantment` from `vAugmentOption` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-26 21:10:08
