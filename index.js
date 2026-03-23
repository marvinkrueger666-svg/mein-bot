const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ------------------ Moderations-Daten ------------------
const warnings = new Map();
const modLogs = [];

// ------------------ Spam-Schutz ------------------
const cooldowns = new Map();
const cooldown = 2000;

// ------------------ Bot startet ------------------
client.once('ready', async () => {
  console.log('Bot ist online!');

  const commands = [

    new SlashCommandBuilder()
      .setName('ankündigung')
      .setDescription('Schreibt eine Ankündigung in den Kanal')
      .addStringOption(option =>
        option.setName('nachricht')
          .setDescription('Die Nachricht')
          .setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Gibt einem Nutzer eine Warnung')
      .addUserOption(option => option.setName('user').setDescription('Der Nutzer').setRequired(true))
      .addStringOption(option => option.setName('grund').setDescription('Grund').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kickt einen Nutzer')
      .addUserOption(option => option.setName('user').setDescription('Der Nutzer').setRequired(true))
      .addStringOption(option => option.setName('grund').setDescription('Grund').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Bannt einen Nutzer')
      .addUserOption(option => option.setName('user').setDescription('Der Nutzer').setRequired(true))
      .addStringOption(option => option.setName('grund').setDescription('Grund').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Mute einen Nutzer temporär')
      .addUserOption(option => option.setName('user').setDescription('Der Nutzer').setRequired(true))
      .addIntegerOption(option => option.setName('sekunden').setDescription('Dauer in Sekunden').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('lock')
      .setDescription('Sperrt einen Kanal')
      .addChannelOption(option => option.setName('channel').setDescription('Der Kanal').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('unlock')
      .setDescription('Entsperrt einen Kanal')
      .addChannelOption(option => option.setName('channel').setDescription('Der Kanal').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Löscht Nachrichten')
      .addIntegerOption(option => option.setName('anzahl').setDescription('Anzahl').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('logs')
      .setDescription('Zeigt Moderationslogs')
      .toJSON(),

    // ✅ UPRANK COMMAND
    new SlashCommandBuilder()
      .setName('uprank')
      .setDescription('Gibt einem Nutzer einen Rang')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('Der Nutzer')
          .setRequired(true))
      .addRoleOption(option =>
        option.setName('rolle')
          .setDescription('Die neue Rolle')
          .setRequired(true))
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
      message.channel.send(`${message.author}, bitte nicht spammen!`)
        .then(msg => setTimeout(() => msg.delete(), 3000));
      return;
    }
    cooldowns.set(userId, now);
  }

  if (message.content.toLowerCase() === '!ping') {
    message.channel.send(`Pong! 🏓 ${message.author}`);
  }
});

// ------------------ Slash-Commands ------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const member = interaction.member;

  // ✅ Permission Check (jetzt mit Rollen!)
  if (!member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    if (interaction.commandName !== 'logs') {
      return interaction.reply({ content: 'Du hast keine Berechtigung!', ephemeral: true });
    }
  }

  // ------------------ /uprank ------------------
  if (interaction.commandName === 'uprank') {
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('rolle');

    const memberTarget = await interaction.guild.members.fetch(user.id);

    const oldRole = memberTarget.roles.highest;

    await memberTarget.roles.add(role);

    modLogs.push({
      type: 'UPRANK',
      user: user.tag,
      moderator: member.user.tag,
      oldRole: oldRole.name,
      newRole: role.name,
      timestamp: new Date().toLocaleString()
    });

    return interaction.reply({
      content: `⬆️ **UPRANK!**

👤 Nutzer: ${user}
📉 Vorher: **${oldRole.name}**
📈 Jetzt: **${role.name}**

Glückwunsch! 🎉`
    });
  }

  // ------------------ /warn ------------------
  if (interaction.commandName === 'warn') {
    const user = interaction.options.getUser('user');
    const grund = interaction.options.getString('grund');

    const currentWarnings = warnings.get(user.id) || 0;
    warnings.set(user.id, currentWarnings + 1);

    modLogs.push({ type: 'WARN', user: user.tag, moderator: member.user.tag, reason: grund, timestamp: new Date().toLocaleString() });

    return interaction.reply(`⚠️ ${user} wurde gewarnt! Grund: ${grund}`);
  }

  // ------------------ /kick ------------------
  if (interaction.commandName === 'kick') {
    const user = interaction.options.getUser('user');
    const memberTarget = await interaction.guild.members.fetch(user.id);

    await memberTarget.kick();

    return interaction.reply(`✅ ${user} wurde gekickt!`);
  }

  // ------------------ /ban ------------------
  if (interaction.commandName === 'ban') {
    const user = interaction.options.getUser('user');
    const memberTarget = await interaction.guild.members.fetch(user.id);

    await memberTarget.ban();

    return interaction.reply(`✅ ${user} wurde gebannt!`);
  }

  // ------------------ /mute ------------------
  if (interaction.commandName === 'mute') {
    const user = interaction.options.getUser('user');
    const sekunden = interaction.options.getInteger('sekunden');
    const memberTarget = await interaction.guild.members.fetch(user.id);

    await memberTarget.timeout(sekunden * 1000);

    return interaction.reply(`🔇 ${user} wurde gemutet!`);
  }

  // ------------------ /lock ------------------
  if (interaction.commandName === 'lock') {
    const channel = interaction.options.getChannel('channel');
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });

    return interaction.reply(`🔒 Kanal gesperrt!`);
  }

  // ------------------ /unlock ------------------
  if (interaction.commandName === 'unlock') {
    const channel = interaction.options.getChannel('channel');
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });

    return interaction.reply(`🔓 Kanal entsperrt!`);
  }

  // ------------------ /clear ------------------
  if (interaction.commandName === 'clear') {
    const anzahl = interaction.options.getInteger('anzahl');
    await interaction.channel.bulkDelete(anzahl, true);

    return interaction.reply(`🧹 ${anzahl} Nachrichten gelöscht!`);
  }

  // ------------------ /logs ------------------
  if (interaction.commandName === 'logs') {
    if (modLogs.length === 0) return interaction.reply('Keine Logs vorhanden.');

    const lastLogs = modLogs.slice(-10).reverse().map(log =>
      `[${log.timestamp}] ${log.type} | ${log.user || ''} ${log.oldRole ? `(${log.oldRole} → ${log.newRole})` : ''}`
    ).join('\n');

    return interaction.reply(`📜 Logs:\n${lastLogs}`);
  }
});

// ------------------ Bot Login ------------------
client.login(process.env.TOKEN);
