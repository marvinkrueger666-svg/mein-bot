require('dotenv').config();

const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ------------------ Daten ------------------
const warnings = new Map();
const modLogs = [];

// ------------------ Spam-Schutz ------------------
const cooldowns = new Map();
const cooldown = 2000;

// ------------------ READY ------------------
client.once('ready', async () => {
  console.log(`✅ Bot online als ${client.user.tag}`);

  const commands = [

    new SlashCommandBuilder()
      .setName('ankündigung')
      .setDescription('Schreibt eine Ankündigung')
      .addStringOption(option =>
        option.setName('nachricht')
          .setDescription('Die Nachricht')
          .setRequired(true)),

    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Warnt einen Nutzer')
      .addUserOption(option => option.setName('user').setRequired(true))
      .addStringOption(option => option.setName('grund').setRequired(true)),

    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kickt einen Nutzer')
      .addUserOption(option => option.setName('user').setRequired(true))
      .addStringOption(option => option.setName('grund').setRequired(true)),

    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Bannt einen Nutzer')
      .addUserOption(option => option.setName('user').setRequired(true))
      .addStringOption(option => option.setName('grund').setRequired(true)),

    new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Mute einen Nutzer')
      .addUserOption(option => option.setName('user').setRequired(true))
      .addIntegerOption(option => option.setName('sekunden').setRequired(true)),

    new SlashCommandBuilder()
      .setName('lock')
      .setDescription('Sperrt Kanal')
      .addChannelOption(option => option.setName('channel').setRequired(true)),

    new SlashCommandBuilder()
      .setName('unlock')
      .setDescription('Entsperrt Kanal')
      .addChannelOption(option => option.setName('channel').setRequired(true)),

    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Löscht Nachrichten')
      .addIntegerOption(option => option.setName('anzahl').setRequired(true)),

    new SlashCommandBuilder()
      .setName('logs')
      .setDescription('Zeigt Logs'),

    new SlashCommandBuilder()
      .setName('uprank')
      .setDescription('Gibt einem Nutzer einen Rang')
      .addUserOption(option => option.setName('user').setRequired(true))
      .addRoleOption(option => option.setName('rolle').setRequired(true))
  ];

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(commands);
  }

  console.log('✅ Slash Commands registriert');
});

// ------------------ MESSAGE ------------------
client.on('messageCreate', message => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const now = Date.now();

  if (cooldowns.has(userId) && now - cooldowns.get(userId) < cooldown) {
    message.delete();
    message.channel.send('Bitte nicht spammen!').then(msg => setTimeout(() => msg.delete(), 3000));
    return;
  }

  cooldowns.set(userId, now);

  if (message.content === '!ping') {
    message.reply('🏓 Pong!');
  }
});

// ------------------ INTERACTIONS ------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const member = interaction.member;

  // ------------------ UPRANK ------------------
  if (interaction.commandName === 'uprank') {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: 'Keine Berechtigung!', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('rolle');
    const target = await interaction.guild.members.fetch(user.id);

    const oldRole = target.roles.highest;

    await target.roles.add(role);

    modLogs.push({
      type: 'UPRANK',
      user: user.tag,
      oldRole: oldRole.name,
      newRole: role.name,
      mod: member.user.tag
    });

    return interaction.reply(`⬆️ **UPRANK**

👤 ${user}
📉 Vorher: ${oldRole.name}
📈 Jetzt: ${role.name}`);
  }

  // ------------------ MOD COMMANDS ------------------
  if (['warn','kick','ban','mute','clear','lock','unlock'].includes(interaction.commandName)) {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: 'Keine Berechtigung!', ephemeral: true });
    }
  }

  if (interaction.commandName === 'ankündigung') {
    const msg = interaction.options.getString('nachricht');
    await interaction.channel.send(`📢 ${msg}`);
    return interaction.reply({ content: 'Gesendet!', ephemeral: true });
  }

  if (interaction.commandName === 'warn') {
    const user = interaction.options.getUser('user');
    const grund = interaction.options.getString('grund');

    warnings.set(user.id, (warnings.get(user.id) || 0) + 1);

    return interaction.reply(`⚠️ ${user} wurde gewarnt (${grund})`);
  }

  if (interaction.commandName === 'kick') {
    const user = interaction.options.getUser('user');
    const target = await interaction.guild.members.fetch(user.id);

    await target.kick();
    return interaction.reply(`👢 ${user} gekickt`);
  }

  if (interaction.commandName === 'ban') {
    const user = interaction.options.getUser('user');
    const target = await interaction.guild.members.fetch(user.id);

    await target.ban();
    return interaction.reply(`🔨 ${user} gebannt`);
  }

  if (interaction.commandName === 'mute') {
    const user = interaction.options.getUser('user');
    const sec = interaction.options.getInteger('sekunden');
    const target = await interaction.guild.members.fetch(user.id);

    await target.timeout(sec * 1000);
    return interaction.reply(`🔇 ${user} gemutet`);
  }

  if (interaction.commandName === 'lock') {
    const channel = interaction.options.getChannel('channel');
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    return interaction.reply('🔒 Kanal gesperrt');
  }

  if (interaction.commandName === 'unlock') {
    const channel = interaction.options.getChannel('channel');
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
    return interaction.reply('🔓 Kanal entsperrt');
  }

  if (interaction.commandName === 'clear') {
    const amount = interaction.options.getInteger('anzahl');
    await interaction.channel.bulkDelete(amount, true);
    return interaction.reply(`🧹 ${amount} gelöscht`);
  }

  if (interaction.commandName === 'logs') {
    if (modLogs.length === 0) return interaction.reply('Keine Logs');

    const text = modLogs.slice(-5).map(l => `${l.type} | ${l.user || ''}`).join('\n');
    return interaction.reply(text);
  }
});

// ------------------ LOGIN ------------------
client.login(process.env.TOKEN);
