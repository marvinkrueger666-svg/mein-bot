const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ------------------ Moderations-Daten ------------------
const warnings = new Map(); // userId -> Anzahl Warnungen
const modLogs = []; // speichert alle Aktionen

// ------------------ Spam-Schutz ------------------
const cooldowns = new Map();
const cooldown = 2000; // 2 Sekunden Abstand

// ------------------ Bot startet ------------------
client.once('ready', async () => {
  console.log('Bot ist online!');

  // ------------------ Slash-Commands ------------------
  const commands = [
    // 1️⃣ Ankündigung
    new SlashCommandBuilder()
      .setName('ankündigung')
      .setDescription('Schreibt eine Ankündigung in den Kanal')
      .addStringOption(option =>
        option.setName('nachricht')
          .setDescription('Die Nachricht')
          .setRequired(true))
      .toJSON(),

    // 2️⃣ Warn
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Gibt einem Nutzer eine Warnung')
      .addUserOption(option => option.setName('user').setDescription('Der Nutzer').setRequired(true))
      .addStringOption(option => option.setName('grund').setDescription('Grund').setRequired(true))
      .toJSON(),

    // 3️⃣ Kick
    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kickt einen Nutzer')
      .addUserOption(option => option.setName('user').setDescription('Der Nutzer').setRequired(true))
      .addStringOption(option => option.setName('grund').setDescription('Grund').setRequired(true))
      .toJSON(),

    // 4️⃣ Ban
    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Bannt einen Nutzer')
      .addUserOption(option => option.setName('user').setDescription('Der Nutzer').setRequired(true))
      .addStringOption(option => option.setName('grund').setDescription('Grund').setRequired(true))
      .toJSON(),

    // 5️⃣ Mute
    new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Mute einen Nutzer temporär (Text)')
      .addUserOption(option => option.setName('user').setDescription('Der Nutzer').setRequired(true))
      .addIntegerOption(option => option.setName('sekunden').setDescription('Mute-Dauer in Sekunden').setRequired(true))
      .toJSON(),

    // 6️⃣ Lock
    new SlashCommandBuilder()
      .setName('lock')
      .setDescription('Sperrt einen Kanal')
      .addChannelOption(option => option.setName('channel').setDescription('Der Kanal').setRequired(true))
      .toJSON(),

    // 7️⃣ Unlock
    new SlashCommandBuilder()
      .setName('unlock')
      .setDescription('Entsperrt einen Kanal')
      .addChannelOption(option => option.setName('channel').setDescription('Der Kanal').setRequired(true))
      .toJSON(),

    // 8️⃣ Clear
    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Löscht Nachrichten')
      .addIntegerOption(option => option.setName('anzahl').setDescription('Anzahl Nachrichten').setRequired(true))
      .toJSON(),

    // 9️⃣ Logs
    new SlashCommandBuilder()
      .setName('logs')
      .setDescription('Zeigt die letzten Moderationsaktionen')
      .toJSON()
  ];

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(commands);
  }
  console.log('Slash-Commands registriert!');
});

// ------------------ Nachrichten-Listener ------------------
client.on('messageCreate', message => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const now = Date.now();

  if (!cooldowns.has(userId)) cooldowns.set(userId, now);
  else {
    const lastTime = cooldowns.get(userId);
    if (now - lastTime < cooldown) {
      message.delete();
      message.channel.send(`${message.author}, bitte nicht spammen!`).then(msg => setTimeout(() => msg.delete(), 3000));
      return;
    }
    cooldowns.set(userId, now);
  }

  if (message.content.toLowerCase() === '!ping') {
    message.channel.send(`Pong! 🏓 ${message.author}`);
  }
});

// ------------------ Slash-Commands ausführen ------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const member = interaction.member;

  // Berechtigungscheck
  if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    if (interaction.commandName !== 'logs') {
      return interaction.reply({ content: 'Du hast keine Berechtigung!', ephemeral: true });
    }
  }

  // ------------------ /ankündigung ------------------
  if (interaction.commandName === 'ankündigung') {
    const nachricht = interaction.options.getString('nachricht');
    await interaction.channel.send(`📢 **Ankündigung:** ${nachricht}`);
    modLogs.push({ type: 'ANKÜNDIGUNG', moderator: member.user.tag, message: nachricht, timestamp: new Date().toLocaleString() });
    await interaction.reply({ content: 'Ankündigung gesendet!', ephemeral: true });
  }

  // ------------------ /warn ------------------
  if (interaction.commandName === 'warn') {
    const user = interaction.options.getUser('user');
    const grund = interaction.options.getString('grund');
    const currentWarnings = warnings.get(user.id) || 0;
    warnings.set(user.id, currentWarnings + 1);

    modLogs.push({ type: 'WARN', user: user.tag, moderator: member.user.tag, reason: grund, timestamp: new Date().toLocaleString() });

    await interaction.reply({ content: `⚠️ ${user} wurde gewarnt! Grund: ${grund}\nAnzahl Warnungen: ${warnings.get(user.id)}`, ephemeral: false });
  }

  // ------------------ /kick ------------------
  if (interaction.commandName === 'kick') {
    const user = interaction.options.getUser('user');
    const grund = interaction.options.getString('grund');
    const memberTarget = await interaction.guild.members.fetch(user.id);

    await memberTarget.kick(grund);
    modLogs.push({ type: 'KICK', user: user.tag, moderator: member.user.tag, reason: grund, timestamp: new Date().toLocaleString() });

    await interaction.reply({ content: `✅ ${user} wurde gekickt!`, ephemeral: false });
  }

  // ------------------ /ban ------------------
  if (interaction.commandName === 'ban') {
    const user = interaction.options.getUser('user');
    const grund = interaction.options.getString('grund');
    const memberTarget = await interaction.guild.members.fetch(user.id);

    await memberTarget.ban({ reason: grund });
    modLogs.push({ type: 'BAN', user: user.tag, moderator: member.user.tag, reason: grund, timestamp: new Date().toLocaleString() });

    await interaction.reply({ content: `✅ ${user} wurde gebannt!`, ephemeral: false });
  }

  // ------------------ /mute ------------------
  if (interaction.commandName === 'mute') {
    const user = interaction.options.getUser('user');
    const sekunden = interaction.options.getInteger('sekunden');
    const memberTarget = await interaction.guild.members.fetch(user.id);

    await memberTarget.timeout(sekunden * 1000, 'Temporäres Muten');
    modLogs.push({ type: 'MUTE', user: user.tag, moderator: member.user.tag, duration: sekunden + 's', timestamp: new Date().toLocaleString() });

    await interaction.reply({ content: `🔇 ${user} wurde für ${sekunden} Sekunden gemutet.`, ephemeral: false });
  }

  // ------------------ /lock ------------------
  if (interaction.commandName === 'lock') {
    const channel = interaction.options.getChannel('channel');
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    modLogs.push({ type: 'LOCK', channel: channel.name, moderator: member.user.tag, timestamp: new Date().toLocaleString() });
    await interaction.reply({ content: `🔒 ${channel} wurde gesperrt!`, ephemeral: false });
  }

  // ------------------ /unlock ------------------
  if (interaction.commandName === 'unlock') {
    const channel = interaction.options.getChannel('channel');
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
    modLogs.push({ type: 'UNLOCK', channel: channel.name, moderator: member.user.tag, timestamp: new Date().toLocaleString() });
    await interaction.reply({ content: `🔓 ${channel} wurde entsperrt!`, ephemeral: false });
  }

  // ------------------ /clear ------------------
  if (interaction.commandName === 'clear') {
    const anzahl = interaction.options.getInteger('anzahl');
    await interaction.channel.bulkDelete(anzahl, true);
    modLogs.push({ type: 'CLEAR', moderator: member.user.tag, count: anzahl, timestamp: new Date().toLocaleString() });
    await interaction.reply({ content: `🧹 ${anzahl} Nachrichten gelöscht.`, ephemeral: false });
  }

  // ------------------ /logs ------------------
  if (interaction.commandName === 'logs') {
    if (modLogs.length === 0) return interaction.reply({ content: 'Es gibt noch keine Logs.', ephemeral: true });
    const lastLogs = modLogs.slice(-10).reverse();
    const logMessage = lastLogs.map(log => {
      let base = `**[${log.timestamp}]** ${log.type} | Moderator: ${log.moderator}`;
      if (log.user) base += ` | User: ${log.user}`;
      if (log.reason) base += ` | Grund: ${log.reason}`;
      if (log.channel) base += ` | Channel: ${log.channel}`;
      if (log.count) base += ` | Count: ${log.count}`;
      if (log.duration) base += ` | Dauer: ${log.duration}`;
      if (log.message) base += ` | Nachricht: ${log.message}`;
      return base;
    }).join('\n');

    await interaction.reply({ content: `📜 **Letzte Moderationsaktionen:**\n${logMessage}`, ephemeral: false });
  }
});

// ------------------ Bot einloggen ------------------
client.login(process.env.TOKEN);