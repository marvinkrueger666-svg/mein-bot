require('dotenv').config();

const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ---------------- READY ----------------
client.once('clientReady', async () => {
  console.log(`✅ Bot online als ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('ankündigung')
      .setDescription('Sendet eine Ankündigung')
      .addStringOption(option =>
        option.setName('nachricht').setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('uprank')
      .setDescription('Gibt Rolle')
      .addUserOption(option => option.setName('user').setRequired(true))
      .addRoleOption(option => option.setName('rolle').setRequired(true))
  ];

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(commands);
  }

  console.log('✅ Commands registriert');
});

// ---------------- COMMANDS ----------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // 🔥 WICHTIG → verhindert "reagiert nicht"
  await interaction.deferReply();

  try {

    // ---------------- ANKÜNDIGUNG ----------------
    if (interaction.commandName === 'ankündigung') {
      const msg = interaction.options.getString('nachricht');

      await interaction.channel.send(`📢 ${msg}`);

      return interaction.editReply('✅ Gesendet!');
    }

    // ---------------- UPRANK ----------------
    if (interaction.commandName === 'uprank') {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.editReply('❌ Keine Rechte!');
      }

      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('rolle');
      const target = await interaction.guild.members.fetch(user.id);

      const oldRole = target.roles.highest;

      await target.roles.add(role);

      return interaction.editReply(
        `⬆️ UPRANK

👤 ${user}
📉 Vorher: ${oldRole.name}
📈 Jetzt: ${role.name}`
      );
    }

  } catch (err) {
    console.error(err);
    return interaction.editReply('❌ Fehler beim Command!');
  }
});

// ---------------- LOGIN ----------------
client.login(process.env.TOKEN);
