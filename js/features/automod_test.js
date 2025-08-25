// Test script for automod.js
import { containsBannedWords, looksLikeSpam } from './automod.js';

const testCases = [
  'profile picture',
  'about me',
  'this is a test',
  'free money',
  'porn',
  'hello world',
  'asshole',
  'bastard',
  'buy now',
  'subscribe',
  `p.s. don't forget that you can add your profile picture and share some information about yourself (if you feel like it) in about me section`,
];

testCases.forEach(text => {
  // test helper - no console output by default
  const _ = [containsBannedWords(text), looksLikeSpam(text)];
});
