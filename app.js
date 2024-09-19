const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const cors = require('cors');
const cron = require('node-cron');
const app = express();

app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect('mongodb+srv://parveshtest:Parvesh%40123987@cluster0.qgfonjs.mongodb.net/whatsappBackendTest?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based in JavaScript
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// MongoDB User Schema and Model
const userSchema = new mongoose.Schema({
  _id: String,
  name: { type: String, default: null },
  mobileNumber: String,
});
const User = mongoose.model('User', userSchema);

// MongoDB Group Schema and Model
const groupSchema = new mongoose.Schema({
  groupName: { type: String, required: true },
  users: [
    {
      userId: { type: String, required: true },
      raName:{type:String,default:null},
      name: { type: String, default: null },
      mobileNumber: { type: String, required: true },
    }
  ],
  dateCreatedOn: {
    type: String, // Store the date as a string
    default: () => formatDate(new Date()), // Format the date as DD/MM/YYYY before saving
  },
});
const Group = mongoose.model('Group', groupSchema);

// MongoDB Schedule Schema and Model
const scheduleSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },
  scheduledTime: { type: Date, required: true },
  status: { type: String, default: 'pending' },
  dateCreatedOn: {
    type: String, // Store the date as a string
    default: () => formatDate(new Date()), // Format the date as DD/MM/YYYY before saving
  },
});

const Schedule = mongoose.model('Schedule', scheduleSchema);



const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  apiUrl: { type: String, required: true, default: 'https://backend.aisensy.com/campaign/t1/api/v2' },
  apiKey: { type: String, required: true },
  campaignName: { type: String, required: true },
  userName: { type: String, required: true },
  source: { type: String },
  mediaUrl: { type: String }, // Ensure mediaUrl is included
  mediaFilename: { type: String },
  templateParams: [{ type: String }], // Optional
  tags: [{ type: String }], // Optional
  attributes: { type: Map, of: String }, // Optional attributes
  dateCreated: { type: Date, default: Date.now },
});

const Template = mongoose.model('Template', templateSchema);



// Swagger options
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Express API for Groups, Users, and Scheduling',
      version: '1.0.0',
      description: 'API to manage groups, users, and scheduling WhatsApp messages',
    },
    servers: [
      {
        url: 'http://localhost:5001',
      },
    ],
  },
  apis: ['./app.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /api/groups:
 *   post:
 *     summary: Create a new group with users
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupName:
 *                 type: string
 *                 required: true
 *               users:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     mobileNumber:
 *                       type: string
 *     responses:
 *       201:
 *         description: Group created successfully.
 */
app.post('/api/groups', async (req, res) => {
  const { groupName, users } = req.body;

  if (!groupName || !Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: 'Group name and a list of users are required.' });
  }

  try {
    const newGroup = new Group({
      groupName,
      users,
    });

    await newGroup.save();
    res.status(200).json({ message: 'Group created successfully.', group: newGroup });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'An error occurred while creating the group.' });
  }
});

/**
 * @swagger
 * /api/groups:
 *   get:
 *     summary: Get all groups with their users
 *     responses:
 *       200:
 *         description: A list of groups with users.
 */
app.get('/api/groups', async (req, res) => {
  try {
    const groups = await Group.find();
    res.status(200).json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'An error occurred while fetching the groups.' });
  }
});

/**
 * @swagger
 * /api/groups/{groupId}:
 *   delete:
 *     summary: Delete a group by its ID
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group deleted successfully.
 *       404:
 *         description: Group not found.
 *       500:
 *         description: An error occurred while deleting the group.
 */
app.delete('/api/groups/:groupId', async (req, res) => {
  const { groupId } = req.params;

  try {
    const deletedGroup = await Group.findByIdAndDelete(groupId);

    if (!deletedGroup) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    res.status(200).json({ message: 'Group deleted successfully.' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'An error occurred while deleting the group.' });
  }
});

/**
 * @swagger
 * /api/groups/{groupId}:
 *   patch:
 *     summary: Update a group (name or users)
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupName:
 *                 type: string
 *               users:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     mobileNumber:
 *                       type: string
 *     responses:
 *       200:
 *         description: Group updated successfully.
 */
app.patch('/api/groups/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const { groupName, users } = req.body;

  try {
    const updateData = {};

    if (groupName) {
      updateData.groupName = groupName;
    }

    if (Array.isArray(users) && users.length > 0) {
      updateData.users = users;
    }

    const updatedGroup = await Group.findByIdAndUpdate(groupId, updateData, { new: true });

    if (!updatedGroup) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    res.status(200).json({ message: 'Group updated successfully.', group: updatedGroup });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'An error occurred while updating the group.' });
  }
});


/**
 * @swagger
 * /api/groups/{groupId}:
 *   get:
 *     summary: Get a group by its ID
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group retrieved successfully.
 *       404:
 *         description: Group not found.
 *       500:
 *         description: An error occurred while retrieving the group.
 */
app.get('/api/groups/:groupId', async (req, res) => {
  const { groupId } = req.params;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }
    res.status(200).json(group);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'An error occurred while fetching the group.' });
  }
});


/**
 * @swagger
 * /api/templates:
 *   post:
 *     summary: Create a new template
 *     description: Create a WhatsApp message template with details like API URL, campaign name, user info, and media.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - apiUrl
 *               - apiKey
 *               - campaignName
 *               - userName
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the template.
 *               apiUrl:
 *                 type: string
 *                 description: API URL for sending the message.
 *               apiKey:
 *                 type: string
 *                 description: API key provided by AiSensy.
 *               campaignName:
 *                 type: string
 *                 description: Campaign name as created in AiSensy.
 *               userName:
 *                 type: string
 *                 description: Name of the user for the campaign.
 *               templateParams:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Dynamic template parameters.
 *               media:
 *                 type: object
 *                 properties:
 *                   url:
 *                     type: string
 *                     description: URL of the media to be sent.
 *                   filename:
 *                     type: string
 *                     description: Filename of the media.
 *     responses:
 *       201:
 *         description: Template created successfully.
 *       500:
 *         description: Error occurred while creating the template.
 */
app.post('/api/templates', async (req, res) => {
  try {
    const templateData = req.body;
    const template = new Template(templateData);
    await template.save();
    res.status(201).json({ message: 'Template saved successfully.', template });
  } catch (error) {
    res.status(500).json({ error: 'Error saving template', details: error.message });
  }
});

/**
 * @swagger
 * /api/templates:
 *   get:
 *     summary: Get all templates
 *     description: Retrieve all the stored WhatsApp message templates.
 *     responses:
 *       200:
 *         description: A list of all message templates.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Template'
 *       500:
 *         description: Error occurred while fetching the templates.
 */



app.get('/api/templates', async (req, res) => {
  try {
    const templates = await Template.find();
    res.status(200).json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching templates', details: error.message });
  }
});
/**
 * @swagger
 * /api/templates/{id}:
 *   patch:
 *     summary: Update a template
 *     description: Update a template's details like `campaignName`, `mediaUrl`, or `templateParams`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               campaignName:
 *                 type: string
 *                 description: The new campaign name.
 *               media:
 *                 type: object
 *                 properties:
 *                   url:
 *                     type: string
 *                     description: URL of the new media.
 *                   filename:
 *                     type: string
 *                     description: Filename of the media.
 *               templateParams:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of updated template parameters.
 *     responses:
 *       200:
 *         description: Template updated successfully.
 *       404:
 *         description: Template not found.
 *       500:
 *         description: Error occurred while updating the template.
 */




app.patch('/api/templates/:id', async (req, res) => {
  try {
    const updatedTemplate = await Template.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedTemplate) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.status(200).json({ message: 'Template updated successfully', updatedTemplate });
  } catch (error) {
    res.status(500).json({ error: 'Error updating template', details: error.message });
  }
});

/**
 * @swagger
 * /api/templates/{id}:
 *   delete:
 *     summary: Delete a template by ID
 *     description: Remove a template from the database by its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template deleted successfully.
 *       404:
 *         description: Template not found.
 *       500:
 *         description: Error occurred while deleting the template.
 */


app.delete('/api/templates/:id', async (req, res) => {
  try {
    const deletedTemplate = await Template.findByIdAndDelete(req.params.id);
    if (!deletedTemplate) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.status(200).json({ message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting template', details: error.message });
  }
});
/**
 * @swagger
 * /api/templates/{id}:
 *   get:
 *     summary: Get a template by ID
 *     description: Retrieve a specific WhatsApp message template by its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     responses:
 *       200:
 *         description: The requested template data.
 *       404:
 *         description: Template not found.
 *       500:
 *         description: Error occurred while fetching the template.
 */



/**
 * @swagger
 * /api/schedule:
 *   post:
 *     summary: Schedule a WhatsApp message to a group
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *             
 *               groupId:
 *                 type: string
 *                 required: true
 *               template:
 *                 type: string
 *                 required: true
 *               scheduledTime:
 *                 type: string
 *                 format: date-time
 *                 required: true
 *               status:
 *                  type: string
 *                 
 *     responses:
 *       200:
 *         description: Message scheduled successfully.
 */
app.post('/api/schedule', async (req, res) => {
  const { groupId, templateId, scheduledTime, status } = req.body;

  if (!groupId || !templateId || !scheduledTime || !status) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const schedule = new Schedule({
      groupId,
      templateId,
      scheduledTime,
      status
    });

    await schedule.save();
    res.status(200).json({ message: 'Schedule created successfully.', schedule });
  } catch (error) {
    console.error('Error scheduling message:', error);
    res.status(500).json({ error: 'An error occurred while scheduling the message.' });
  }
});

/**
 * @swagger
 * /api/schedule/{scheduleId}:
 *   get:
 *     summary: Get a schedule by its ID
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Schedule retrieved successfully.
 *       404:
 *         description: Schedule not found.
 *       500:
 *         description: An error occurred while retrieving the schedule.
 */
app.get('/api/schedule/:scheduleId', async (req, res) => {
  const { scheduleId } = req.params;

  try {
    const schedule = await Schedule.findById(scheduleId).populate('groupId templateId');
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }
    res.status(200).json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'An error occurred while fetching the schedule.' });
  }
});

/**
 * @swagger
 * /api/schedule/{scheduleId}:
 *   delete:
 *     summary: Delete a Schedule by its ID
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Schedule deleted successfully.
 *       404:
 *         description: Schedule not found.
 *       500:
 *         description: An error occurred while deleting the Schedule.
 */
app.delete('/api/schedule/:scheduleId', async (req, res) => {
  const { scheduleId } = req.params;

  try {
    const deleteSchedule = await Schedule.findByIdAndDelete(scheduleId);

    if (!deleteSchedule) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }

    res.status(200).json({ message: 'Schedule deleted successfully.' });
  } catch (error) {
    console.error('Error deleting Schedule:', error);
    res.status(500).json({ error: 'An error occurred while deleting the Schedule.' });
  }
});

/**
 * @swagger
 * /api/schedule:
 *   get:
 *     summary: Get all scheduled messages
 *     responses:
 *       200:
 *         description: List of scheduled messages.
 */
app.get('/api/schedule', async (req, res) => {
  try {
    const schedules = await Schedule.find().populate('groupId');
    res.status(200).json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'An error occurred while fetching schedules.' });
  }
});

/**
 * @swagger
 * /api/schedule/{scheduleId}:
 *   patch:
 *     summary: Update a scheduled message
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               template:
 *                 type: string
 *               scheduledTime:
 *                 type: string
 *                 format: date-time
 *               status:
 *                  type: string
 *     responses:
 *       200:
 *         description: Schedule updated successfully.
 */
app.patch('/api/schedule/:scheduleId', async (req, res) => {
  const { scheduleId } = req.params;
  const { template, scheduledTime, status } = req.body;

  try {
    const updateData = {};

    if (template) {
      updateData.template = template;
    }

    if (scheduledTime) {
      updateData.scheduledTime = scheduledTime;
    }

    if (status) {
      updateData.status = status;
    }

    const updatedSchedule = await Schedule.findByIdAndUpdate(scheduleId, updateData, { new: true });

    if (!updatedSchedule) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }

    res.status(200).json({ message: 'Schedule updated successfully.', schedule: updatedSchedule });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'An error occurred while updating the schedule.' });
  }
});



// Function to send WhatsApp message

 // Import the template model or path as per your project structure

// Function to send WhatsApp message to a group
const sendMessageToGroup = async (group, templateId) => {
  console.log(`Fetching template with ID: ${templateId}`);

  // Fetch the template by its ID
  const template = await Template.findById(templateId);
  if (!template) {
    console.error('Template not found.');
    return;
  }

  console.log(`Template found: ${template.name}, proceeding with message batch processing.`);
  const batchSize = 50; // Number of messages to send in a single batch
  const apiUrl = template.apiUrl; // Fetch API URL from the template

  // Function to dynamically replace template parameters
  const replaceTemplateParams = (templateParams, user) => {
    return templateParams.map(param => {
      if (param === '$UserName') return user.name || 'User'; // Replace with user name or default to 'User'
      if (param === '$FirstName') return user.name || 'User'; // Assuming FirstName is also the user's name
      if (param === '$Discount') return '90'; // Hardcoded discount, you may want to fetch this dynamically
      return param; // Return param as is if no match is found
    });
  };

  // Loop through the group users in batches of batchSize
  for (let i = 0; i < group.users.length; i += batchSize) {
    const batchUsers = group.users.slice(i, i + batchSize); // Get batch of users

    const messages = batchUsers.map(user => {
      // Replace dynamic params for each user
      const templateParamsReplaced = replaceTemplateParams(template.templateParams, user);

      return {
        apiKey: template.apiKey,
        campaignName: template.campaignName, // Use the correct campaign name
        destination: user.mobileNumber,
        userName: template.userName,
        templateParams: templateParamsReplaced, // Replaced dynamic params
        source: template.source || "new-landing-page form",
        media: {
          url: template.mediaUrl || "", // Ensure a valid media URL is provided if required
          filename: template.mediaFilename || "", // Ensure a valid filename is provided
        },
        paramsFallbackValue: {
          FirstName: user.name || "user", // Dynamically use the user's name
          Discount: 90, // Set discount dynamically or use fallback
          UserName: user.name || "User" // User's name fallback
        }
      };
    });

    console.log(`Messages to be sent:`, JSON.stringify(messages, null, 2)); // Log the message payloads

    try {
      // Send the messages batch via Axios
      const responses = await Promise.all(
        messages.map(message =>
          axios.post(apiUrl, message, {
            headers: {
              'Content-Type': 'application/json',
            }
          })
        )
      );

      // Log the result of each message batch
      responses.forEach(response => console.log(`Batch send result:`, response.data));
    } catch (error) {
      // Improved error logging
      if (error.response) {
        console.error(`Error sending batch messages:`, error.response.data);
      } else if (error.request) {
        console.error(`No response received:`, error.request);
      } else {
        console.error('Error:', error.message);
      }
    }
  }
};


module.exports = sendMessageToGroup;


// Cron job to check for scheduled messages and send them
cron.schedule('* * * * *', async () => { // This runs every minute
  console.log(`Cron job triggered at ${new Date().toISOString()}`);
  try {
    const dueSchedules = await Schedule.find({ scheduledTime: { $lte: new Date() }, status: 'pending' });
    console.log(`Current system time: ${new Date().toISOString()}`);
    const earliestSchedule = await Schedule.find().sort({scheduledTime: 1}).limit(1);
    if (earliestSchedule.length) {
        console.log(`Earliest scheduled time in DB: ${earliestSchedule[0].scheduledTime.toISOString()}`);
    } else {
        console.log("No schedules in DB.");
    }

    console.log(`Found ${dueSchedules.length} due schedules to process.`);
    for (const schedule of dueSchedules) {
      console.log(`Processing schedule ID: ${schedule._id} for group ID: ${schedule.groupId}`);
      const group = await Group.findById(schedule.groupId);
      if (group) {
        console.log(`Group found: ${group.name}. Sending messages.`);
        await sendMessageToGroup(group, schedule.templateId);
        schedule.status = 'sent';
        await schedule.save();
        console.log(`Schedule ID: ${schedule._id} status updated to 'sent'.`);
      } else {
        console.log(`No group found for group ID: ${schedule.groupId}`);
      }
    }
  } catch (error) {
    console.error('Error processing scheduled messages:', error);
  }
});

// Start the server
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});
