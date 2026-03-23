require('dotenv').config();

const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ------------------ Daten ------------------
const warnings = new Map();
const modLogs = [];
const cooldowns = new Map();
const cooldown = 2000;

// ------------------ READY ------------------
client.once('clientReady', async () => {
  console.log(`✅ Bot online als ${client.user.tag}`);

  const commands = [

    new SlashCommandBuilder()
      .setName('ankündigung')
      .setDescription('Sendet eine Ankündigung')
      .addStringOption(option =>
        option.setName('nachricht')
          .setDescription('Die Nachricht')
          .setRequired(true)),

    new SlashCommandBuilder()
      .setName('uprank')
      .setDescription('Gibt einem Nutzer eine Rolle')
      .addUserOption(option => option.setName('user').setRequired(true))
      .addRoleOption(option => option.setName('rolle').setRequired(true)),

    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Warnt einen Nutzer')
      .addUserOption(option => option.setName('user').setRequired(true))
      .addStringOption(option => option.setName('grund').setRequired(true)),

    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Löscht Nachrichten')
      .addIntegerOption(option => option.setName('anzahl').setRequired(true))
  ];

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(commands);
  }

  console.log('✅ Commands neu registriert!');
});

// ------------------ MESSAGE ------------------
client.on('messageCreate', message => {
  if (message.author.bot) return;

  const now = Date.now();
  const last = cooldowns.get(message.author.id);

  if (last && now - last < cooldown) {
    message.delete();
    return;
  }

  cooldowns.set(message.author.id, now);

  if (message.content === '!ping') {
    message.reply('🏓 Pong!');
  }
});

// ------------------ COMMANDS ------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {

    // ------------------ ANKÜNDIGUNG ------------------
    if (interaction.commandName === 'ankündigung') {
      const msg = interaction.options.getString('nachricht');

      await interaction.channel.send(`📢 **Ankündigung:**\n${msg}`);

      return interaction.reply({ content: '✅ Gesendet!', ephemeral: true });
    }

    // ------------------ UPRANK ------------------
    if (interaction.commandName === 'uprank') {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.reply({ content: '❌ Keine Rechte!', ephemeral: true });
      }

      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('rolle');
      const target = await interaction.guild.members.fetch(user.id);

      const oldRole = target.roles.highest;

      await target.roles.add(role);

      return interaction.reply(
        `⬆️ **UPRANK!**

👤 ${user}
📉 Vorher: ${oldRole.name}
📈 Jetzt: ${role.name}

🎉 Glückwunsch!`
      );
    }

    // ------------------ WARN ------------------
    if (interaction.commandName === 'warn') {
      const user = interaction.options.getUser('user');
      const grund = interaction.options.getString('grund');

      warnings.set(user.id, (warnings.get(user.id) || 0) + 1);

      return interaction.reply(`⚠️ ${user} wurde gewarnt!\nGrund: ${grund}`);
    }

    // ------------------ CLEAR ------------------
    if (interaction.commandName === 'clear') {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return interaction.reply({ content: '❌ Keine Rechte!', ephemeral: true });
      }

      const amount = interaction.options.getInteger('anzahl');

      await interaction.channel.bulkDelete(amount, true);

      return interaction.reply({ content: `🧹 ${amount} gelöscht`, ephemeral: true });
    }

  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      interaction.reply({ content: '❌ Fehler beim Command!', ephemeral: true });
    }
  }
});

// ------------------ LOGIN ------------------
client.login(process.env.TOKEN);
