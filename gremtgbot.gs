var apiToken = "token"; // Telegram bot token
var appUrl = "url";
var apiUrl = "https://api.telegram.org/bot" + apiToken;

// Set the Webhook URL for the bot
function setWebhook() {
  var url = apiUrl + "/setWebhook?url=" + appUrl;
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}

// Handle incoming messages from the bot
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var chatId = data.message.chat.id;
    var text = data.message.text;

    if (text.startsWith("/add")) {
      var params = text.substring(5).split("|");
      if (params.length < 2) {
        sendMessage(chatId, "Invalid format. Use: /add text | YYYY-MM-DD HH:mm");
        return;
      }

      var reminderText = params[0].trim();
      var reminderTime = new Date(params[1].trim());
      if (isNaN(reminderTime.getTime())) {
        sendMessage(chatId, "Invalid date format. Use: YYYY-MM-DD HH:mm");
        return;
      }

      saveReminder(chatId, reminderText, reminderTime);
      sendMessage(chatId, `Reminder added: "${reminderText}" at ${reminderTime}`);
    } else if (text.startsWith("/list")) {
      var reminders = getReminders(chatId);
      if (reminders.length === 0) {
        sendMessage(chatId, "You have no active reminders.");
        return;
      }

      var message = "Your reminders:\n";
      reminders.forEach(function (r, index) {
        message += `${index + 1}. ${r.text} - ${r.time}\n`;
      });
      sendMessage(chatId, message);
    } else if (text.startsWith("/delete")) {
      var index = parseInt(text.substring(8).trim());
      if (deleteReminder(chatId, index)) {
        sendMessage(chatId, "Reminder successfully deleted.");
      } else {
        sendMessage(chatId, "Could not find a reminder with that number.");
      }
    } else if (text.startsWith("/cleartriggers")) {
      clearAllTriggers();
      sendMessage(chatId, "All your reminders have been cleared.");
    } else if (text.startsWith("/startv")) {
      sendMessage(
        chatId,
        "Hello! I am a reminder bot. Here's what I can do:\n" +
        "1. Add a reminder: /add text | YYYY-MM-DD HH:mm\n" +
        "2. View reminders: /list\n" +
        "3. Delete a reminder: /delete number\n" +
        "4. Clear all triggers: /cleartriggers"
      );
    } else {
      sendMessage(chatId, "I don't understand. Try using /start.");
    }
  } catch (error) {
    Logger.log("Error: " + error.message);
  }
}

// Save reminders to Google Sheets
function saveReminder(chatId, text, time) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.appendRow([chatId, text, time]);
  createTriggerForRow(sheet.getLastRow());
}

// Get all reminders for a specific user
function getReminders(chatId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  return data
    .filter(function (row) {
      return row[0] == chatId;
    })
    .map(function (row) {
      return { text: row[1], time: row[2] };
    });
}

// Delete a specific reminder
function deleteReminder(chatId, index) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var userReminders = data.filter(function (row) {
    return row[0] == chatId;
  });

  if (index > 0 && index <= userReminders.length) {
    var reminderRow = data.findIndex(function (row) {
      return row[0] == chatId && row[1] == userReminders[index - 1][1] && row[2] == userReminders[index - 1][2];
    });
    if (reminderRow !== -1) {
      sheet.deleteRow(reminderRow + 1);
      deleteReminderTrigger(reminderRow + 1);
      return true;
    }
  }
  return false;
}

// Create a time-based trigger for a specific row
function createTriggerForRow(row) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getRange(row, 1, 1, 3).getValues()[0];
  var chatId = data[0];
  var text = data[1];
  var time = new Date(data[2]);

  if (!isNaN(time.getTime())) {
    ScriptApp.newTrigger("sendReminder")
      .timeBased()
      .at(time)
      .create();
  }
}

// Clear all triggers
function clearAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
}

// Send the reminder message when the trigger fires
function sendReminder() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();

    data.forEach(function (row, index) {
      var chatId = row[0];
      var text = row[1];
      var time = new Date(row[2]);
      var status = row[3];

      if (!status && time <= new Date()) {
        sendMessage(chatId, `🔔 Reminder: ${text}`);
        sheet.getRange(index + 1, 4).setValue("done");
      }
    });
  } catch (e) {
    Logger.log("Error in sendReminder: " + e.message);
  }
}

// Send a message to the user via Telegram
function sendMessage(chatId, text) {
  var url = apiUrl + "/sendMessage?chat_id=" + chatId + "&text=" + encodeURIComponent(text);
  UrlFetchApp.fetch(url);
}

// Delete a specific trigger by row
function deleteReminderTrigger(row) {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "sendReminder") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
