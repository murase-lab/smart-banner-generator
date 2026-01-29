// Project CRUD API - Get, Update, Delete single project

/**
 * GET /api/projects/:id - Get a single project with full data
 */
export async function onRequestGet(context) {
  const { request, env, params } = context

  try {
    const projectId = params.id
    const url = new URL(request.url)
    const deviceId = url.searchParams.get('deviceId')

    if (!deviceId) {
      return new Response(JSON.stringify({ error: 'Device ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!env.PROJECTS_KV) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const key = `project:${deviceId}:${projectId}`
    const project = await env.PROJECTS_KV.get(key, 'json')

    if (!project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ project }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error getting project:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to get project'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * PUT /api/projects/:id - Update a project
 */
export async function onRequestPut(context) {
  const { request, env, params } = context

  try {
    const projectId = params.id
    const body = await request.json()
    const { deviceId, project } = body

    if (!deviceId) {
      return new Response(JSON.stringify({ error: 'Device ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!env.PROJECTS_KV) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const key = `project:${deviceId}:${projectId}`
    const existingProject = await env.PROJECTS_KV.get(key, 'json')

    if (!existingProject) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Merge updates with existing data
    const updatedProject = {
      ...existingProject,
      name: project.name ?? existingProject.name,
      productName: project.productName ?? existingProject.productName,
      productDescription: project.productDescription ?? existingProject.productDescription,
      targetAudience: project.targetAudience ?? existingProject.targetAudience,
      designGoal: project.designGoal ?? existingProject.designGoal,
      vibe: project.vibe ?? existingProject.vibe,
      additionalNotes: project.additionalNotes ?? existingProject.additionalNotes,
      brandLogoName: project.brandLogoName !== undefined ? project.brandLogoName : existingProject.brandLogoName,
      productImages: project.productImages ?? existingProject.productImages,
      updatedAt: Date.now(),
    }

    await env.PROJECTS_KV.put(key, JSON.stringify(updatedProject))

    return new Response(JSON.stringify({
      success: true,
      project: {
        id: updatedProject.id,
        name: updatedProject.name,
        productName: updatedProject.productName,
        createdAt: updatedProject.createdAt,
        updatedAt: updatedProject.updatedAt,
        imageCount: updatedProject.productImages?.length || 0,
        hasLogo: !!updatedProject.brandLogoName,
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error updating project:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to update project'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * DELETE /api/projects/:id - Delete a project
 */
export async function onRequestDelete(context) {
  const { request, env, params } = context

  try {
    const projectId = params.id
    const url = new URL(request.url)
    const deviceId = url.searchParams.get('deviceId')

    if (!deviceId) {
      return new Response(JSON.stringify({ error: 'Device ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!env.PROJECTS_KV) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const key = `project:${deviceId}:${projectId}`

    // Check if project exists
    const existingProject = await env.PROJECTS_KV.get(key, 'json')
    if (!existingProject) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    await env.PROJECTS_KV.delete(key)

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error deleting project:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to delete project'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
