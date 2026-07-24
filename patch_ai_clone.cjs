const fs = require('fs');
let content = fs.readFileSync('src/pages/AICloneSettings.tsx', 'utf8');

const targetLoad = `    if (data) {
      setConfig({
        enabled: data.ai_clone_enabled || false,
        personality: data.ai_clone_personality || '',
        greeting: data.bio || "Hey! I'm currently away but my AI clone can help. What's up?",
        allowJobInquiries: true,
        allowBusinessChats: true,
        allowNetworking: true,
        responseDelay: 3,
        maxResponseLength: 200,
        offHoursOnly: false,
        blockedTopics: '',
      });
    }`;

const replaceLoad = `    if (data) {
      const configJson = data.ai_clone_config || {};
      const boundariesJson = data.ai_clone_boundaries || {};
      setConfig({
        enabled: data.ai_clone_enabled || false,
        personality: data.ai_clone_personality || '',
        greeting: data.bio || "Hey! I'm currently away but my AI clone can help. What's up?",
        allowJobInquiries: boundariesJson.allow_job_inquiries ?? true,
        allowBusinessChats: boundariesJson.allow_business ?? true,
        allowNetworking: boundariesJson.allow_networking ?? true,
        responseDelay: configJson.response_delay ?? 3,
        maxResponseLength: boundariesJson.max_reply_length ?? 200,
        offHoursOnly: configJson.off_hours_only ?? false,
        blockedTopics: configJson.blocked_topics ?? '',
      });
    }`;

const targetSave = `    const { error } = await supabase
      .from('user_identities' as any)
      .update({
        ai_clone_enabled: config.enabled,
        ai_clone_personality: config.personality,
        bio: config.greeting,
      } as any)
      .eq('user_id', user.id)
      .eq('suffix', 'ai') as any;`;

const replaceSave = `    const { error } = await supabase
      .from('user_identities' as any)
      .update({
        ai_clone_enabled: config.enabled,
        ai_clone_personality: config.personality,
        bio: config.greeting,
        ai_clone_config: {
          response_delay: config.responseDelay,
          off_hours_only: config.offHoursOnly,
          blocked_topics: config.blockedTopics
        },
        ai_clone_boundaries: {
          allow_job_inquiries: config.allowJobInquiries,
          allow_business: config.allowBusinessChats,
          allow_networking: config.allowNetworking,
          max_reply_length: config.maxResponseLength
        }
      } as any)
      .eq('user_id', user.id)
      .eq('suffix', 'ai') as any;`;

content = content.replace(targetLoad, replaceLoad);
content = content.replace(targetSave, replaceSave);

fs.writeFileSync('src/pages/AICloneSettings.tsx', content);
console.log('AICloneSettings.tsx updated successfully.');
