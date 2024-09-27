// app.js

const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const cors = require('cors');
const cron = require('node-cron');

dotenv.config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ['http://localhost:3000', 'https://whatsapp.copartner.in'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.options('*', cors()); // Handle OPTIONS request for CORS

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

// MongoDB Schemas and Models

// User Schema
const userSchema = new mongoose.Schema({
  _id: String,
  name: { type: String, default: null },
  mobileNumber: String,
});
const User = mongoose.model('User', userSchema);

// Group Schema
const groupSchema = new mongoose.Schema({
  groupName: { type: String, required: true },
  users: [
    {
      userId: { type: String, required: true },
      raName: { type: String, default: null },
      name: { type: String, default: null },
      mobileNumber: { type: String, required: true },
    },
  ],
  dateCreatedOn: { type: Date, default: Date.now },
});
const Group = mongoose.model('Group', groupSchema);

// Template Schema
const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  apiUrl: {
    type: String,
    required: true,
    default: 'https://backend.aisensy.com/campaign/t1/api/v2',
  },
  apiKey: { type: String, required: true },
  campaignName: { type: String, required: true },
  userName: { type: String, required: true },
  source: { type: String },
  mediaUrl: { type: String },
  mediaFilename: { type: String },
  templateParams: [{ type: String }],
  tags: [{ type: String }],
  attributes: { type: Map, of: String },
  dateCreated: { type: Date, default: Date.now },
});
const Template = mongoose.model('Template', templateSchema);

// Schedule Schema
const scheduleSchema = new mongoose.Schema({
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },
  scheduledTime: { type: Date, required: true },
  status: { type: String, default: 'pending' },
  dateCreatedOn: { type: Date, default: Date.now },
});
scheduleSchema.index({ scheduledTime: 1 });
scheduleSchema.index({ status: 1 });
const Schedule = mongoose.model('Schedule', scheduleSchema);

// Schedule Group Schema
const scheduleGroupSchema = new mongoose.Schema({
  scheduleName: { type: String, required: true, unique: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  schedules: [
    {
      scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule', required: true },
      status: { type: String, default: 'pending' },
    },
  ],
  status: { type: String, default: 'pending' }, // Overall status of the schedule group
  dateCreatedOn: { type: Date, default: Date.now },
});
scheduleGroupSchema.index({ scheduleName: 1 }, { unique: true });
const ScheduleGroup = mongoose.model('ScheduleGroup', scheduleGroupSchema);

// Swagger options
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Express API for Groups, Users, Templates, and Scheduling',
      version: '1.0.0',
      description: 'API to manage groups, users, templates, and scheduling WhatsApp messages',
    },
    servers: [
      {
        url: 'https://whatsapp.copartner.in/',
      },
    ],
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            mobileNumber: { type: 'string' },
          },
        },
        Group: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            groupName: { type: 'string' },
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  raName: { type: 'string' },
                  name: { type: 'string' },
                  mobileNumber: { type: 'string' },
                },
              },
            },
            dateCreatedOn: { type: 'string', format: 'date-time' },
          },
        },
        Template: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            apiUrl: { type: 'string' },
            apiKey: { type: 'string' },
            campaignName: { type: 'string' },
            userName: { type: 'string' },
            source: { type: 'string' },
            mediaUrl: { type: 'string' },
            mediaFilename: { type: 'string' },
            templateParams: {
              type: 'array',
              items: { type: 'string' },
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
            attributes: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
            dateCreated: { type: 'string', format: 'date-time' },
          },
        },
        Schedule: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            templateId: { type: 'string' },
            scheduledTime: { type: 'string', format: 'date-time' },
            status: { type: 'string' },
            dateCreatedOn: { type: 'string', format: 'date-time' },
          },
        },
        ScheduleGroup: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            scheduleName: { type: 'string' },
            groupId: { type: 'string' },
            schedules: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  scheduleId: { type: 'string' },
                  status: { type: 'string' },
                },
              },
            },
            status: { type: 'string' },
            dateCreatedOn: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: ['./app.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// API Endpoints

// Group Endpoints
/**
 * @swagger
 * /api/groups:
 *   post:
 *     summary: Create a new group with users
 *     tags:
 *       - Groups
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - groupName
 *               - users
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
 *                     raName:
 *                       type: string
 *                     name:
 *                       type: string
 *                     mobileNumber:
 *                       type: string
 *     responses:
 *       200:
 *         description: Group created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Group'
 *       400:
 *         description: Bad request.
 *       500:
 *         description: Server error.
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
 *     tags:
 *       - Groups
 *     responses:
 *       200:
 *         description: A list of groups with users.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Group'
 *       500:
 *         description: Server error.
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

// Other group endpoints (GET, PATCH, DELETE by ID) can be added similarly...

// Template Endpoints
/**
 * @swagger
 * /api/templates:
 *   post:
 *     summary: Create a new template
 *     tags:
 *       - Templates
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Template'
 *     responses:
 *       200:
 *         description: Template saved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Template'
 *       500:
 *         description: Error occurred while creating the template.
 */
app.post('/api/templates', async (req, res) => {
  try {
    const templateData = req.body;
    const template = new Template(templateData);
    await template.save();
    res.status(200).json({ message: 'Template saved successfully.', template });
  } catch (error) {
    res.status(500).json({ error: 'Error saving template', details: error.message });
  }
});

/**
 * @swagger
 * /api/templates:
 *   get:
 *     summary: Get all templates
 *     tags:
 *       - Templates
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 apiUrl:
 *                   type: string
 *                 apiKey:
 *                   type: string
 *                 campaignName:
 *                   type: string
 *                 userName:
 *                   type: string
 *                 templateParams:
 *                   type: array
 *                   items:
 *                     type: string
 *                 media:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     filename:
 *                       type: string
 *       404:
 *         description: Template not found.
 *       500:
 *         description: Error occurred while fetching the template.
 */
app.get('/api/templates/:id', async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.status(200).json(template);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching template', details: error.message });
  }
});
// Other template endpoints (GET, PATCH, DELETE by ID) can be added similarly...

// Schedule Group Endpoints
/**
 * @swagger
 * /api/schedule-groups:
 *   post:
 *     summary: Create a new schedule group with multiple schedules
 *     tags:
 *       - Schedule Groups
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scheduleName
 *               - groupId
 *               - schedules
 *             properties:
 *               scheduleName:
 *                 type: string
 *               groupId:
 *                 type: string
 *               schedules:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - templateId
 *                     - scheduledTime
 *                   properties:
 *                     templateId:
 *                       type: string
 *                     scheduledTime:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       200:
 *         description: Schedule group created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScheduleGroup'
 *       400:
 *         description: Bad request.
 *       500:
 *         description: Server error.
 */
app.post('/api/schedule-groups', async (req, res) => {
  const { scheduleName, groupId, schedules } = req.body;

  if (!scheduleName || !groupId || !Array.isArray(schedules) || schedules.length === 0) {
    return res.status(400).json({ error: 'scheduleName, groupId, and a list of schedules are required.' });
  }

  try {
    // Check if scheduleName already exists
    const existingGroup = await ScheduleGroup.findOne({ scheduleName });
    if (existingGroup) {
      return res.status(400).json({ error: 'Schedule name already exists. Please choose a different name.' });
    }

    // Create individual schedules
    const createdSchedules = await Promise.all(
      schedules.map(async (sched) => {
        const { templateId, scheduledTime } = sched;
        const schedule = new Schedule({ templateId, scheduledTime });
        await schedule.save();
        return { scheduleId: schedule._id, status: schedule.status };
      })
    );

    // Create schedule group
    const scheduleGroup = new ScheduleGroup({
      scheduleName,
      groupId,
      schedules: createdSchedules,
    });

    await scheduleGroup.save();

    res.status(200).json({ message: 'Schedule group created successfully.', scheduleGroup });
  } catch (error) {
    console.error('Error creating schedule group:', error);
    res.status(500).json({ error: 'An error occurred while creating the schedule group.' });
  }
});

/**
 * @swagger
 * /api/schedule-groups:
 *   get:
 *     summary: Get all schedule groups with their schedules
 *     tags:
 *       - Schedule Groups
 *     responses:
 *       200:
 *         description: A list of schedule groups with their schedules.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ScheduleGroup'
 *       500:
 *         description: Server error.
 */
app.get('/api/schedule-groups', async (req, res) => {
  try {
    const scheduleGroups = await ScheduleGroup.find()
      .populate('groupId')
      .populate({
        path: 'schedules.scheduleId',
        populate: { path: 'templateId' },
      });

    res.status(200).json(scheduleGroups);
  } catch (error) {
    console.error('Error fetching schedule groups:', error);
    res.status(500).json({ error: 'An error occurred while fetching schedule groups.' });
  }
});

/**
 * @swagger
 * /api/groups/{groupId}/add-users:
 *   patch:
 *     summary: Add users to an existing group without replacing old users
 *     tags:
 *       - Groups
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the group to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - users
 *             properties:
 *               users:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - userId
 *                     - mobileNumber
 *                   properties:
 *                     userId:
 *                       type: string
 *                     raName:
 *                       type: string
 *                     name:
 *                       type: string
 *                     mobileNumber:
 *                       type: string
 *     responses:
 *       200:
 *         description: Users added to the group successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Group'
 *       400:
 *         description: Bad request.
 *       404:
 *         description: Group not found.
 *       500:
 *         description: An error occurred while updating the group.
 */
app.patch('/api/groups/:groupId/add-users', async (req, res) => {
  const { groupId } = req.params;
  const { users } = req.body;

  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: 'A list of users is required.' });
  }

  try {
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    // Create a set of existing userIds for quick lookup
    const existingUserIds = new Set(group.users.map((user) => user.userId));

    // Filter out users that already exist in the group
    const newUsers = users.filter((newUser) => !existingUserIds.has(newUser.userId));

    // Add new users to the group
    group.users.push(...newUsers);

    // Save the updated group
    await group.save();

    res.status(200).json({ message: 'Users added to the group successfully.', group });
  } catch (error) {
    console.error('Error adding users to group:', error);
    res.status(500).json({ error: 'An error occurred while adding users to the group.' });
  }
});

/**
 * @swagger
 * /api/schedule-groups/{groupId}:
 *   get:
 *     summary: Get a schedule group by its ID
 *     tags:
 *       - Schedule Groups
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Schedule group retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScheduleGroup'
 *       404:
 *         description: Schedule group not found.
 *       500:
 *         description: Server error.
 */
app.get('/api/schedule-groups/:groupId', async (req, res) => {
  const { groupId } = req.params;

  try {
    const scheduleGroup = await ScheduleGroup.findById(groupId)
      .populate('groupId')
      .populate({
        path: 'schedules.scheduleId',
        populate: { path: 'templateId' },
      });

    if (!scheduleGroup) {
      return res.status(404).json({ error: 'Schedule group not found.' });
    }

    res.status(200).json(scheduleGroup);
  } catch (error) {
    console.error('Error fetching schedule group:', error);
    res.status(500).json({ error: 'An error occurred while fetching the schedule group.' });
  }
});

/**
 * @swagger
 * /api/schedule-groups/{groupId}:
 *   patch:
 *     summary: Update a schedule group
 *     tags:
 *       - Schedule Groups
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
 *               scheduleName:
 *                 type: string
 *               groupId:
 *                 type: string
 *               schedules:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     scheduleId:
 *                       type: string
 *                     templateId:
 *                       type: string
 *                     scheduledTime:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *     responses:
 *       200:
 *         description: Schedule group updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScheduleGroup'
 *       404:
 *         description: Schedule group not found.
 *       400:
 *         description: Bad request.
 *       500:
 *         description: Server error.
 */
app.patch('/api/schedule-groups/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const { scheduleName, groupId: newGroupId, schedules } = req.body;

  try {
    const updateData = {};

    if (scheduleName) {
      // Check if the new scheduleName is unique
      const existingGroup = await ScheduleGroup.findOne({ scheduleName, _id: { $ne: groupId } });
      if (existingGroup) {
        return res.status(400).json({ error: 'Schedule name already exists. Please choose a different name.' });
      }
      updateData.scheduleName = scheduleName;
    }

    if (newGroupId) {
      updateData.groupId = newGroupId;
    }

    const scheduleGroup = await ScheduleGroup.findById(groupId);
    if (!scheduleGroup) {
      return res.status(404).json({ error: 'Schedule group not found.' });
    }

    if (Array.isArray(schedules)) {
      // Update existing schedules or add new ones
      for (const sched of schedules) {
        if (sched.scheduleId) {
          // Update existing schedule
          await Schedule.findByIdAndUpdate(
            sched.scheduleId,
            {
              templateId: sched.templateId || undefined,
              scheduledTime: sched.scheduledTime || undefined,
              status: sched.status || undefined,
            },
            { new: true }
          );
        } else {
          // Create a new schedule
          const newSchedule = new Schedule({
            templateId: sched.templateId,
            scheduledTime: sched.scheduledTime,
          });
          await newSchedule.save();
          scheduleGroup.schedules.push({ scheduleId: newSchedule._id, status: newSchedule.status });
        }
      }
    }

    // Update schedule group
    await ScheduleGroup.findByIdAndUpdate(groupId, updateData, { new: true });

    // Save the updated schedules array
    await scheduleGroup.save();

    const updatedGroup = await ScheduleGroup.findById(groupId)
      .populate('groupId')
      .populate({
        path: 'schedules.scheduleId',
        populate: { path: 'templateId' },
      });

    res.status(200).json({ message: 'Schedule group updated successfully.', scheduleGroup: updatedGroup });
  } catch (error) {
    console.error('Error updating schedule group:', error);
    res.status(500).json({ error: 'An error occurred while updating the schedule group.' });
  }
});

/**
 * @swagger
 * /api/schedule-groups/{groupId}:
 *   delete:
 *     summary: Delete a schedule group by its ID
 *     tags:
 *       - Schedule Groups
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Schedule group and associated schedules deleted successfully.
 *       404:
 *         description: Schedule group not found.
 *       500:
 *         description: Server error.
 */
app.delete('/api/schedule-groups/:groupId', async (req, res) => {
  const { groupId } = req.params;

  try {
    const scheduleGroup = await ScheduleGroup.findById(groupId);
    if (!scheduleGroup) {
      return res.status(404).json({ error: 'Schedule group not found.' });
    }

    // Delete all associated schedules
    const scheduleIds = scheduleGroup.schedules.map((sched) => sched.scheduleId);
    await Schedule.deleteMany({ _id: { $in: scheduleIds } });

    // Delete the schedule group
    await ScheduleGroup.findByIdAndDelete(groupId);

    res.status(200).json({ message: 'Schedule group and associated schedules deleted successfully.' });
  } catch (error) {
    console.error('Error deleting schedule group:', error);
    res.status(500).json({ error: 'An error occurred while deleting the schedule group.' });
  }
});

// Function to send WhatsApp messages to a group
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
    // Build a mapping of placeholders to their corresponding values
    const placeholderValues = {
      '$UserName': user.name || 'User',
      '$FirstName': 'Hailgro',
      '$RaName': user.raName || '',
      // Add additional placeholders and their values here
    };

    return templateParams.map((param) => {
      // Replace placeholders in the param string
      let replacedParam = param.replace(/\$[A-Za-z0-9_]+/g, (match) => {
        if (placeholderValues.hasOwnProperty(match)) {
          return placeholderValues[match];
        }
        return match;
      });

      // Remove any parameter labels like 'Param1:' or 'Param2:'
      // Assuming labels are prefixed like 'Param1:' in the string
      // Adjust the regex if labels are formatted differently
      replacedParam = replacedParam.replace(/Param\d+:\s*/g, '');

      return replacedParam;
    });
  };

  // Loop through the group users in batches of batchSize
  for (let i = 0; i < group.users.length; i += batchSize) {
    const batchUsers = group.users.slice(i, i + batchSize); // Get batch of users

    const messages = batchUsers.map((user) => {
      // Replace dynamic params for each user
      const templateParamsReplaced = replaceTemplateParams(template.templateParams, user);

      return {
        apiKey: template.apiKey,
        campaignName: template.campaignName, // Use the correct campaign name
        destination: user.mobileNumber,
        userName: template.userName,
        // Send templateParams as an array of values without labels
        templateParams: templateParamsReplaced,
        source: template.source || 'new-landing-page form',
        media: {
          url: template.mediaUrl || '', // Ensure a valid media URL is provided if required
          filename: template.mediaFilename || '', // Ensure a valid filename is provided
        },
        paramsFallbackValue: {
          RAname: user.raName || '',
          UserName: user.name || 'User', // User's name fallback
          // Include other fallback values if necessary
        },
      };
    });

    console.log(`Messages to be sent:`, JSON.stringify(messages, null, 2)); // Log the message payloads

    try {
      // Send the messages batch via Axios
      const responses = await Promise.all(
        messages.map((message) =>
          axios.post(apiUrl, message, {
            headers: {
              'Content-Type': 'application/json',
            },
          })
        )
      );

      // Log the result of each message batch
      responses.forEach((response) => console.log(`Batch send result:`, response.data));
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



// Cron job to check for scheduled messages and send them
cron.schedule('* * * * *', async () => {
  // This runs every minute
  console.log(`Cron job triggered at ${new Date().toISOString()}`);
  try {
    // Find schedule groups with at least one schedule due
    const dueScheduleGroups = await ScheduleGroup.find({
      status: 'pending',
    })
      .populate('groupId')
      .populate({
        path: 'schedules.scheduleId',
        populate: { path: 'templateId' },
      });

    for (const group of dueScheduleGroups) {
      console.log(`Processing Schedule Group: ${group.scheduleName}`);

      // Filter schedules that are due
      const dueSchedules = group.schedules.filter((sched) => {
        return sched.scheduleId.scheduledTime <= new Date() && sched.status === 'pending';
      });

      if (dueSchedules.length === 0) {
        console.log(`No due schedules in group: ${group.scheduleName}`);
        continue;
      }

      for (const sched of dueSchedules) {
        console.log(`Processing Schedule ID: ${sched.scheduleId._id}`);

        const groupData = group.groupId; // Populated Group

        if (!groupData) {
          console.log(`Group data not found for Schedule ID: ${sched.scheduleId._id}`);
          continue;
        }

        // Send messages using the sendMessageToGroup function
        await sendMessageToGroup(groupData, sched.scheduleId.templateId._id);

        // Update schedule status to 'sent'
        sched.status = 'sent';
        sched.scheduleId.status = 'sent';
        await sched.scheduleId.save();
      }

      // Check if all schedules in the group are sent
      const allSent = group.schedules.every((sched) => sched.status === 'sent');

      if (allSent) {
        group.status = 'sent';
        await group.save();
        console.log(`All schedules in group ${group.scheduleName} are sent. Group status updated.`);
      } else {
        // Save the group to update the statuses of individual schedules
        await group.save();
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
