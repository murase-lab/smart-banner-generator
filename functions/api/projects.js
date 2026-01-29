// Project CRUD API - List and Create
// Uses Cloudflare KV for storage

/**
 * GET /api/projects - List all projects for a device
 */
export async function onRequestGet(context) {
  const { request, env } = context

  try {
    const url = new URL(request.url)
    const deviceId = url.searchParams.get('deviceId')

    if (!deviceId) {
      return new Response(JSON.stringify({ error: 'Device ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if KV is configured
    if (!env.PROJECTS_KV) {
      return new Response(JSON.stringify({
        error: 'KV not configured',
        projects: []
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // List all projects for this device
    const prefix = `project:${deviceId}:`
    const list = await env.PROJECTS_KV.list({ prefix })

    // Fetch all project metadata (without images for faster loading)
    const projects = await Promise.all(
      list.keys.map(async (key) => {
        const data = await env.PROJECTS_KV.get(key.name, 'json')
        if (data) {
          // Return metadata only (exclude large image data for list view)
          return {
            id: data.id,
            name: data.name,
            productName: data.productName,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            imageCount: data.productImages?.length || 0,
            hasLogo: !!data.brandLogoName,
          }
        }
        return null
      })
    )

    // Filter out nulls and sort by updatedAt descending
    const validProjects = projects
      .filter(Boolean)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))

    return new Response(JSON.stringify({ projects: validProjects }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error listing projects:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to list projects'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * POST /api/projects - Create a new project
 */
export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const body = await request.json()
    const { deviceId, project } = body

    if (!deviceId) {
      return new Response(JSON.stringify({ error: 'Device ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!project || !project.name) {
      return new Response(JSON.stringify({ error: 'Project name required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if KV is configured
    if (!env.PROJECTS_KV) {
      return new Response(JSON.stringify({
        error: 'KV not configured. Please set up Cloudflare KV binding.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate project ID
    const projectId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()

    const projectData = {
      id: projectId,
      name: project.name,
      productName: project.productName || '',
      productDescription: project.productDescription || '',
      targetAudience: project.targetAudience || '',
      designGoal: project.designGoal || '商品販売',
      vibe: project.vibe || '',
      additionalNotes: project.additionalNotes || '',
      brandLogoName: project.brandLogoName || null,
      productImages: project.productImages || [],
      createdAt: now,
      updatedAt: now,
    }

    // Store in KV
    const key = `project:${deviceId}:${projectId}`
    await env.PROJECTS_KV.put(key, JSON.stringify(projectData))

    return new Response(JSON.stringify({
      success: true,
      project: {
        id: projectData.id,
        name: projectData.name,
        productName: projectData.productName,
        createdAt: projectData.createdAt,
        updatedAt: projectData.updatedAt,
        imageCount: projectData.productImages?.length || 0,
        hasLogo: !!projectData.brandLogoName,
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error creating project:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to create project'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
